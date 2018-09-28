<?php
namespace Stanford\DatabaseCleanup;

//require_once "emLoggerTrait.php";

class DatabaseCleanup extends \ExternalModules\AbstractExternalModule
{
    //use emLoggerTrait;

    public function getDuplicateCounts($project_id) {
        $start_ts = microtime(true);
        $project_id = intval($project_id);
        $sql1 = "select count(*) as 'distinct' from (select distinct * from redcap_data where project_id = " . db_escape($project_id) . ") d";
        $sql2 = "select count(*) as 'total' from redcap_data where project_id = " . db_escape($project_id);
        $q1 = db_result(db_query($sql1),0);
        $q2 = db_result(db_query($sql2),0);

        // Duration in ms seconds
        $duration = round((microtime(true) - $start_ts) * 1000, 3);

        return array(
            "project_id" => $project_id,
            "distinct" => +$q1,
            "total" => +$q2,
            "duplicates" => $q2-$q1,
            "duration" => $duration
        );
    }


    /**
     * Get all projects in the system
     * @param null $query
     * @return array
     */
    public function getAllProjects($query = null) {
        $projects = array();
        $sql = "SELECT project_id, app_title FROM redcap_projects";
        if (!empty($query)) $sql .= " WHERE project_id LIKE '%$query%' OR app_title LIKE '%$query%'";
        $q = db_query($sql);
        while ($row = db_fetch_assoc($q)) {
            $pid = $row['project_id'];
            $projects[$pid] = $row['app_title'];
        }
        return $projects;
    }


    /**
     * Get Projects in format that is good for select2 ajax call
     * @param null $query
     * @return array
     */
    public function getAllProjectOptions($query = null) {
        $projects = $this->getAllProjects($query);
        $options = array();
        foreach ($projects as $pid => $title) {
            $options[] = array(
                "id" => $pid,
                "text" => "[" . $pid . "] " . $title
            );
        }
        return $options;
    }



    public function deduplicateProject($pid) {
        if (empty($pid)) return array( "error" => "Missing project_id");

        //$this->doSql("DROP TABLE IF EXISTS redcap_data_database_cleanup_temp");
        $this->doSql("CREATE TEMPORARY TABLE IF NOT EXISTS redcap_data_database_cleanup_temp
            (
              project_id int(10) default 0 not null,
              event_id   int(10)           null,
              record     varchar(100)      null,
              field_name varchar(100)      null,
              value      text              null,
              instance   smallint(4)       null
            ) collate = utf8_unicode_ci");

        //$result = $this->doSql("SELECT DISTINCT * FROM redcap_data WHERE project_id = " . $pid);
        db_query("SET AUTOCOMMIT=0");
        db_query("START TRANSACTION");

        $result = $this->doSql("INSERT INTO redcap_data_database_cleanup_temp
            SELECT DISTINCT * FROM redcap_data WHERE project_id = " . $pid);

        if ($result) $result = $this->doSql("DELETE FROM redcap_data WHERE project_id = " . $pid);

        if ($result) $result = $this->doSql("INSERT INTO redcap_data
            SELECT * FROM redcap_data_database_cleanup_temp WHERE project_id = " . $pid);
        if ($result) $result = $this->doSql("DELETE FROM redcap_data_database_cleanup_temp WHERE project_id = " . $pid);

        if ($result) {
            $this->doSql("COMMIT;");
        } else {
            $this->doSql("ROLLBACK;");
        }

        db_query("SET AUTOCOMMIT=1");

        return $result;
    }


    public function doSql($sql) {
        $q = db_query($sql);
        return $q;
    }

}