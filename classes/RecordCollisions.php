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

    public $maxDelta = 3;       // Maximum number of seconds between inserts

    public function __construct()
    {
        global $module;
        $this->module = $module;
    }


    /**
     * Get all projects in the that are likely to be symptomatic
     * @param null $query
     * @return array
     */
    public function getAllProjects($query = null) {
        $projects = array();
        // $sql = "select p.project_id, p.app_title from redcap_projects p join debug_survey_dup_potential dsdp on p.project_id = dsdp.project_id";
        $sql = "select project_id, app_title from redcap_projects";
        if (!empty($query)) $sql .= " WHERE project_id LIKE '%$query%' OR app_title LIKE '%$query%'";
        $q = db_query($sql);
        while ($row = db_fetch_assoc($q)) {
            $pid = $row['project_id'];
            $projects[$pid] = $row['app_title'];
        }
        return $projects;
    }


    /**
     * Clear the cache for the project
     * @param null $project_id
     * @return bool|int
     */
    public function clearCache($project_id = null) {
        $this->module->PREFIX;

        $pid = empty($project_id) ? "" : intval($project_id);

        $sql = "delete rems.* from
                redcap_external_module_settings rems
                join redcap_external_modules rem on rem.external_module_id = rems.external_module_id
            where
                rem.directory_prefix = '" . $this->module->PREFIX . "' and rems.key like 'collision_summary_" . $pid . "%'";

        $this->module->emDebug("clearing Cache", $sql);

        $q = db_query($sql);

        if(!$q) {
            $this->module->emError("Error clearing cache", $q);
            $result = false;
        } else {
            $result = db_affected_rows();
            $this->module->emDebug("Cleared cache, $result cleared");
        }

        return $result;
    }


    public function getProjectCollisionSummary($project_id) {

        // See if we have a cache
        $result_key = "collision_summary_" . $project_id;
        $date_key = $result_key . "_date";

        if ($result = $this->module->getSystemSetting($result_key)) {
            // get the date
            $date = $this->module->getSystemSetting($date_key);
            // TODO: Have an expiration of the date
            if (!empty($date)) {
                $this->module->emDebug("Returning from cache: ", $result);

                // Set duration to 0 to indicate cache
                $result['cache'] = 1;
                return $result;
            }
        }

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

        $result = array(
            "project_id" => $project_id,
            "collisions" => $collisions,
            "records"    => $records,
            "duration"   => round((microtime(true) - $start_ts) * 1000, 3)
        );

        $this->module->setSystemSetting($result_key, $result);
        $this->module->setSystemSetting($date_key, date('Y-m-d H:i:s'));

        $result['cache'] = 0;

        return $result;
    }


}
