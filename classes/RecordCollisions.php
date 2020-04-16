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

    const CACHE_TYPE = "record_collision";  // Used to tag all cache entries

    private $projects;  // cache of projects

    private $module;
    /** @var $module DatabaseCleanup */

    public $maxDelta = 3;       // TODO: Maximum number of seconds between inserts

    public function __construct()
    {
        global $module;
        $this->module = $module;
    }

    /**
     * Function to get all projects and titles
     * @param null $project_id
     * @return array|mixed
     */
    public function getProjects($project_id = null) {

        // Load if object cache is empty
        if(empty($this->projects)) {
            $this->projects = [];

            // Get all projects
            $sql = "select project_id, app_title from redcap_projects where date_deleted is null";
            $q   = db_query($sql);
            while ($row = db_fetch_assoc($q)) {
                $pid                  = $row['project_id'];
                $title                = $row['app_title'];
                $this->projects[$pid] = array(
                    "project_id" => $pid,
                    "title"      => $title
                );
            }
        }

        // Return value
        if(empty($project_id)) {
            return $this->projects;
        } else {
            return $this->projects[$project_id];
        }
    }


    /**
     * Get all projects along with any existing cache
     * @param null $query
     * @return array [ "pid" => [ { pid: xxx, title: "foo", analysis: [ collisions:0, cache:...
     */
    public function loadProjects() {

        $projects = $this->getProjects();

        // Get ALL cache data:
        $sql = sprintf("select message, project_id, timestamp where type = '%s'",
                $this::CACHE_TYPE
        );
        $q   = $this->module->queryLogs($sql);

        // Add cache data to projects
        while ($row = db_fetch_assoc($q)) {
            $project_id = $row['project_id'];
            $this->module->emDebug($project_id);

            if(isset($projects[$project_id])) {
                $this->module->emDebug($projects[$project_id]);
                $projects[$project_id] = array_merge(
                    $projects[$project_id],
                    json_decode($row['message'], true),
                    array("timestamp" => $row['timestamp'])
                );
                // $this->module->emDebug($projects[$project_id]);
            } else {
                // Cache exists for a project that is no longer in the database
                // TODO: delete this cache
            }
        }

        // $this->module->emDebug("Returning projects.  (first five)", array_slice($projects,0,5));
        return $projects;
    }


    /**
     * Clear the cache for a project or range of projects
     * @param null $project_id (can be null for all, or a specific project ID
     * @param null $start is the lower end project_id for a range
     * @param null $end is the higher end project_id for a range
     * @return bool|int
     * @throws \Exception
     */
    public function clearCache($project_id = null, $start=null, $end=null) {

        $where = "type = '" . $this::CACHE_TYPE . "' ";

        if ($project_id === null) {
            // This is a request to delete everything (or a large range of project caches)
            if (!empty($start)) {
                $where .= " AND project_id >= " . intval($start);
            }

            if (!empty($end)) {
                $where .= " AND project_id <= " . intval($end);
            }
        } else {
            // Deleting just one project
            $where .= " AND project_id = " . intval($project_id);
        }
        $result = $this->module->removeLogs($where);

        $this->module->emDebug("Remove cache where $where", $result, db_affected_rows());
        return db_affected_rows();
    }


    /**
     * Get the collision data.  If skip-cache is set true, then ignore the cache
     * @param      $project_id
     * @param bool $skip_cache
     * @return array
     * @throws \Exception
     */
    public function getCollisions($project_id, $skip_cache = false) {
        if (! $skip_cache) {
            // Check cache first
            $sql = sprintf("select message, timestamp where project_id = %d and type = '%s'",
                $project_id,
                $this::CACHE_TYPE
            );
            $q   = $this->module->queryLogs($sql);
            if ($row = db_fetch_assoc($q)) {
                $message = array_merge(
                    json_decode($row['message'], true),
                    array(
                        "timestamp" => $row['timestamp'],
                        "project_id" => $project_id
                    )
                );
                $this->module->emDebug("Retrieved project $project_id by cache");
                return $message;
            }
        }

        // Do the query
        $result = $this->getCollisionDetail($project_id);

        // Remove previous cache (if any)
        $sql = sprintf("project_id = %d and type = '%s'",
            $project_id,
            $this::CACHE_TYPE
        );
        $q = $this->module->removeLogs($sql);
        $this->module->emDebug("Removing logs if they exist", $q);

        // Cache new result
        $message = json_encode($result);
        $q = $this->module->log($message, array(
            "project_id" => $project_id,
            "type"  => $this::CACHE_TYPE
        ));
        $this->module->emDebug("Cached result", $q);

        return $result;
    }


    /**
     * Get collision details
     * @param $project_id
     * @return array
     */
    public function getCollisionDetail($project_id) {

        // Analyze the project
        $start_ts = microtime(true);
        $project_id = intval($project_id);

        // PASSING ON VISUALIZING THIS FOR NOW - ITS MILLER TIME.
        // return $sql;

        // Start the result with the pid and title
        $result = $this->getProjects($project_id);

        // Query for results
        $sql = $this->getCollisionDetailSql($project_id);
        $q = db_query($sql);
        // $result['row_count']  = db_num_rows($q);

        // Each row is a potential collision, e.g. save to same record with different values
        $rows = [];
        $collisions = [];               // These are potential collisions filtered to those that had different data values
        $affected_fields = [];    // These are the fields where differences were logged in the project
        $distinct_records = [];         // Distinct records
        while ($row = db_fetch_assoc($q)) {
            // parse the data values to see if there is any overlap in fields between the two saves
            $dv1 = $this->parseDataValues($row['data_values']);
            $dv2 = $this->parseDataValues($row['data_values_2']);
            $common_keys = array_intersect_key($dv1,$dv2);

            // See if the values in the overlapping fields are different, otherwise ignore
            $differences = [];
            if (!empty($common_keys)) {
                foreach($common_keys as $k => $v) {
                    $v1 = $dv1[$k];
                    $v2 = $dv2[$k];
                    if ($v1 !== $v2) {
                        $differences[] = "[$k] is both " . $dv1[$k] . " and " . $dv2[$k];
                        $affected_fields[] = $k;
                    }
                }
            }
            if (!empty($differences)) {
                $rows[$row['log_event_id']] = $row;
                $distinct_records[] = $row['pk'];
                $collisions[] = array(
                    "record"        => $row['pk'],
                    "event"         => $row['event_id'],
                    "differences"   => $differences
                );
            }
        }

        $result['distinct_records'] = array_unique($distinct_records);
        $result['affected_fields']  = array_count_values($affected_fields);
        $result['duration']         = round((microtime(true) - $start_ts) * 1000, 3);
        $result['collisions']       = $collisions;
        $result['raw_data']         = array("sql" => [$sql], "results" => $rows);

        $this->module->emDebug($result);
        return $result;
    }


    /**
     * Get collision detail SQL
     * @param $project_id
     * @return string|string[]|null
     */
    public function getCollisionDetailSql($project_id) {
        $log_event_table = method_exists('\REDCap', 'getLogEventTable') ? \REDCap::getLogEventTable($project_id) : "redcap_log_event";

        $sql = sprintf("select
                p.project_id,
                l.event_id,
                l.pk,
                l.page,
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
                    and l.log_event_id < m.log_event_id
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


    /**
     * Help parse out fields and values from the log table
     * @param $data_values
     * @return array
     */
    public function parseDataValues($data_values) {
		$result = [];
        $v = explode(",\n", $data_values);
        foreach ($v as $val) {
            list ($key, $val) = explode(" = ", $val, 2);
            $result[$key] = $val;
        }
        return $result;
    }

}
