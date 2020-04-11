<?php
namespace Stanford\DatabaseCleanup;

/**
 * The purpose of this class is to handle record collisions as related to this bug:
 * https://github.com/vanderbilt/REDCap/commit/31abf543b2441c0827144692bf72ca6939a6f3c7
 * https://community.projectredcap.org/questions/81559/return-code-and-email-pdf-glitch.html
 * https://community.projectredcap.org/questions/81104/survey-response-overwritten.html
 *
 * Class RecordCollisions
 * @package Stanford\DatabaseCleanup
 */


class RecordCollisions
{
    private $module;
    /** @var $module DatabaseCleanup */

    public $maxDelta = 3;       // TODO: Maximum number of seconds between inserts

    public function __construct()
    {
        global $module;
        $this->module = $module;
    }


    /**
     * Get all projects along with any existing cache
     * @param null $query
     * @return array [ "pid" => [ { pid: xxx, title: "foo", analysis: [ collisions:0, cache:...
     */
    public function loadProjects() {
        $projects = array();
        $sql = "select project_id, app_title from redcap_projects where date_deleted is null";
        $q = db_query($sql);
        while ($row = db_fetch_assoc($q)) {
            $pid = $row['project_id'];
            $title = $row['app_title'];
            $projects[$pid] = array(
                "pid" => $pid,
                "title" => $title
            );
        }

        // Get cache dates:
        $sql = "select
                rems.key,
                rems.value
            from
                redcap_external_module_settings rems
                join redcap_external_modules rem on rem.external_module_id = rems.external_module_id
            where
                rem.directory_prefix = '" . $this->module->PREFIX . "'
                and rems.key like 'collision_summary_%_date'
                and rems.type='string'";
        $q = db_query($sql);
        $dates = [];
        while ($row = db_fetch_assoc($q)) {
            $pid = str_replace("collision_summary_", "", $row['key']);
            $pid = str_replace("_date", "", $pid);
            $dates[$pid] = $row['value'];
        }

        // Get cache results
        $sql = "select
                rems.key,
                rems.value
            from
                redcap_external_module_settings rems
                join redcap_external_modules rem on rem.external_module_id = rems.external_module_id
            where
                rem.directory_prefix = '" . $this->module->PREFIX . "'
                and rems.key like 'collision_summary_%'
                and rems.type='json-array'";
        $q = db_query($sql);
        while($row = db_fetch_assoc($q)) {
            $values = json_decode($row['value'], true);
            $project_id = $values['project_id'];
            if (!isset($projects[$project_id])) {
                // Project has been deleted
                continue;
            } else {
                // Add cached info to projects payload
                $projects[$project_id]['analysis'] = $values;
                $projects[$project_id]['analysis']['cache_date'] = $dates[$project_id];
            }
        }

        // $this->module->emDebug($projects);
        $projects = $projects;

        return $projects;
    }


    /**
     * Clear the cache for the project
     * @param null $project_id (can be * for all, or a specific project ID
     * @param null $start is the lower end project_id for a range
     * @param null $end is the higher end project_id for a range
     * @return bool|int
     */
    public function clearCache($project_id = null, $start=null, $end=null) {

        $sql = [];
        $preSql = "delete rems.* from redcap_external_module_settings rems
                join redcap_external_modules rem on rem.external_module_id = rems.external_module_id
                where rem.directory_prefix = '" . $this->module->PREFIX . "' ";

        if ($project_id == "*") {
            // This is a request to delete everything (or a large range of project caches)
            if (empty($start) && empty($end)) {
                // Delete everything
                $sql[] = $preSql . "and rems.key like 'collision_summary_%'";
            } else {
                // We have a range of IPs to delete
                $projects = $this->loadProjects();
                foreach ($projects as $pid => $data) {
                    $pid = intval($pid);

                    if (!empty($start) && $pid < intval($start)) continue;
                    if (!empty($end) && $pid > intval($end)) continue;
                    $sql[] = $preSql ."and rems.key like 'collision_summary_" . $pid . "%'";
                }
            }
        } else {
            $sql[] = $preSql ."and rems.key like 'collision_summary_" . intval($project_id) . "%'";
        }

        $count = 0;
        $this->module->emDebug($sql);
        foreach ($sql as $s) {
            $q = db_query($s);
            $this->module->emDebug("Clearing Cache", $q, $s);

            if (!$q) {
                $this->module->emError("Error clearing cache!", $q);
                return false;
            }
            $count =+ db_affected_rows();
        }

        return $count/2;

        // $sql = "delete rems.* from
        //         redcap_external_module_settings rems
        //         join redcap_external_modules rem on rem.external_module_id = rems.external_module_id
        //     where
        //         rem.directory_prefix = '" . $this->module->PREFIX . "' and rems.key like 'collision_summary_" . $pid . "%'";
        //
        // $this->module->emDebug("clearing Cache", $sql);
        //
        // $q = db_query($sql);

        // if(!$q) {
        //     $this->module->emError("Error clearing cache", $q);
        //     $result = false;
        // } else {
        //     $result = db_affected_rows();
        //     $this->module->emDebug("Cleared cache, $result cleared");
        // }
        //
        // return $result;
    }


    /**
     * Look through a project to see if the project has any suspicious double-data-entries in log
     * @param $project_id
     * @return array|mixed|null
     */
    public function getProjectCollisionSummary($project_id) {

        $result_key = "collision_summary_" . $project_id;
        $date_key = $result_key . "_date";

        // // See if we have a cache
        //
        // if ($result = $this->module->getSystemSetting($result_key)) {
        //     // get the date
        //     $date = $this->module->getSystemSetting($date_key);
        //     // TODO: Have an expiration of the date
        //     if (!empty($date)) {
        //         $this->module->emDebug("Returning from cache: ", $result);
        //
        //         // Set duration to 0 to indicate cache
        //         $result['cache_date'] = $date;
        //         return $result;
        //     }
        // }

        // Analyze the project
        $start_ts = microtime(true);
        $project_id = intval($project_id);

        $log_event_table = method_exists('\REDCap', 'getLogEventTable') ? \REDCap::getLogEventTable($project_id) : "redcap_log_event";

        $sql = sprintf("select
                p.project_id,
                p.app_title,
                count(*) as collisions,
                count(distinct l.pk) as records
            from
                redcap_projects p
                join %s l
                    on l.project_id=p.project_id
                    and l.event = 'INSERT'
                    and l.event_id IS NOT NULL
                inner join %s m on
                    l.pk = m.pk
                    and l.event = m.event
                    and l.event_id = m.event_id
                    and l.project_id = m.project_id
                    and l.log_event_id != m.log_event_id
                    and l.data_values != m.data_values
                    and abs(l.ts - m.ts) < 3
            where
                p.project_id = %d
            group by
                p.project_id, p.app_title
            order by
                p.project_id",
            $log_event_table,
            $log_event_table,
            db_escape($project_id)
        );

        $this->module->emDebug($sql);

        $q = db_query($sql);

        if (db_num_rows($q) > 0) {
            $row        = db_fetch_assoc($q);
            $collisions = $row['collisions'];
            $records    = $row['records'];
        } else {
            $collisions = 0;
            $records    = 0;
        }

        $date =  date('Y-m-d H:i:s');

        $result = array(
            "project_id" => $project_id,
            "collisions" => $collisions,
            "records"    => $records,
            "duration"   => round((microtime(true) - $start_ts) * 1000, 3)
        );

        $this->module->setSystemSetting($result_key, $result);
        $this->module->setSystemSetting($date_key,$date);

        $result['cache'] = 0;
        $result['cache_date'] = $date;

        return $result;
    }


    public function getCollisionDetailSql($project_id) {
        $log_event_table = method_exists('\REDCap', 'getLogEventTable') ? \REDCap::getLogEventTable($project_id) : "redcap_log_event";

        $sql = sprintf("select
                p.project_id,
                l.event_id,
                l.pk,
                l.data_values,
                m.data_values as data_values_2,
                l.ts,
                l.log_event_id,
                m.log_event_id as log_event_id_2,
                abs(l.ts - m.ts) as log_delta_sec
            from
                redcap_projects p
                join %s l
                    on l.project_id=p.project_id
                    and l.event = 'INSERT'
                    and l.event_id IS NOT NULL
                inner join %s m on
                    l.pk = m.pk
                    and l.event = m.event
                    and l.event_id = m.event_id
                    and l.project_id = m.project_id
                    and l.log_event_id != m.log_event_id
                    and l.data_values != m.data_values
                    and abs(l.ts - m.ts) < 3
            where
                p.project_id = %d
            order by
                p.project_id, l.event_id, l.pk, l.ts",
            $log_event_table,
            $log_event_table,
            db_escape($project_id)
        );
        // Clean up spacing
        $sql = preg_replace(array('/^\s{12}/m', '/\s+$/m'), array("",""), $sql);
        return $sql;
    }

    public function getCollisionDetail($project_id) {

        // Analyze the project
        $start_ts = microtime(true);
        $project_id = intval($project_id);

        $sql = $this->getCollisionDetailSql($project_id);

        return $sql;

        // PASSING ON VISUALIZING THIS FOR NOW - ITS MILLER TIME.
        $q = db_query($sql);

        $data = [];
        while ($row = db_fetch_assoc($q)) {
            $data[] = $row;
        }

        $result = array(
            "data"       => $data,
            "duration"   => round((microtime(true) - $start_ts) * 1000, 3)
        );

        return $result;
    }
}
