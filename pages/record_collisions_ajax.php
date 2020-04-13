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

    $module->emDebug("Incoming Action", $_POST);

    // Default error
    $result = array("error" => "Invalid Action");

    $rc = new RecordCollisions();

    // Load projects from server/cache to datatable
    if ($action == "load-projects") {
        // $module->emDebug("Loading Projects");
        $result = $rc->loadProjects();
    }

    if ($action == "analyze-project") {
        if (empty($project_id)) {
            $result = array( "error" => "Missing project id" );
        } else {
            $skip_cache = isset($_POST['skip_cache']) ? boolval($_POST['skip_cache']) : false;
            $result = $rc->getCollisions($project_id, $skip_cache);
        }
    }

    // Get the detailed results
    if ($action == "view-details") {
        $result = $rc->getCollisionDetail($project_id);
    }

    // Clear the cache for all projects or selected project
    if ($action == "clear-cache") {
        $project_id    = isset($_POST['project_id'])    ? filter_var($_POST['project_id'],    FILTER_SANITIZE_NUMBER_INT) : null;
        $start_project = isset($_POST['start_project']) ? filter_var($_POST['start_project'], FILTER_SANITIZE_NUMBER_INT) : null;
        $end_project   = isset($_POST['end_project'])   ? filter_var($_POST['end_project'],   FILTER_SANITIZE_NUMBER_INT) : null;
        $result = $rc->clearCache($project_id, $start_project, $end_project);
    }


    echo json_encode($result);
}
