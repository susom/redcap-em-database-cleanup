<?php
namespace Stanford\DatabaseCleanup;
/** @var DatabaseCleanup $module */

if (!SUPER_USER) {
    header("Content-type: application/json");
    echo json_encode(array("Error" => "This utility is only available for REDCap Administrators"));
    exit();
}

/**
 * Get projects for select2 dropdown
 */
if (isset($_GET['_type']) && $_GET['_type'] == "query") {
    if (isset($_GET['getProjects'])) {

        // Get all projects
        $q = isset($_GET['q']) ? $_GET['q'] : null;
        $projects = $module->getAllProjectOptions($q);

        // Add option for ALL projects
        array_unshift($projects, array("id"=>"-- ALL", "text"=>"ALL " . count($projects) . " PROJECTS --"));

        // Return Results
        header("Content-type: application/json");
        echo json_encode(
            [
                "results" => [
                    [
                        "text" => "Projects",
                        "children" => $projects
                    ]
                ]
            ]
        );
    }
}


/**
 * Handle POST Actions
 */
if (isset($_POST['action'])) {
    $action = $_POST['action'];
    $project_id = isset($_POST['project_id']) ? filter_var($_POST['project_id'], FILTER_SANITIZE_NUMBER_INT) : "";

    // Default error
    $result = array("error" => "Invalid Action");

    $rc = new RecordCollisions();

    if ($action == "analyze-project") {
        if (empty($project_id)) {
            $result = array( "error" => "Missing project id" );
        } else {
            // Get project
            $result = $rc->getProjectCollisionSummary($project_id);
        }
    }

    if ($action == "get-all-projects") {
        $result = $rc->getAllProjects();
        // $result = $module->getAllProjects();
    }

    // if ($action == "dedup-project") {
    //     $result = $module->deduplicateProject($project_id);
    // }

    echo json_encode($result);
}


//// BUILD PROJECT SELECT
//$options = array("<option value=''>Select a Project</option>");
//foreach ($projects as $project_id => $title) {
//    $options[] = "<option value='$project_id'" .
//        ( $project_id == $select_pid ? " selected" : "" ).
//        ">[$project_id] $title</option>";
//}
//$select = "<select style='height: 32px;' id='project_select' class='form_control' name='select_pid'>" . implode("",$options) . "</select>";
