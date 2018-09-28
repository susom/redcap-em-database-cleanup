<?php
namespace Stanford\DatabaseCleanup;
/** @var \Stanford\DatabaseCleanup\DatabaseCleanup $module */

require APP_PATH_DOCROOT . "ControlCenter/header.php";

if (!SUPER_USER) {
    ?>
    <div class="jumbotron text-center">
        <h3><span class="glyphicon glyphicon-exclamation-sign"></span> This utility is only available for REDCap Administrators</h3>
    </div>
    <?php
    exit();
}


// LOAD SELECT 2
?>

<link href="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.6-rc.0/css/select2.min.css" rel="stylesheet" />
<link href="https://cdn.datatables.net/1.10.19/css/dataTables.bootstrap4.min.css" rel="stylesheet" />

<script src="https://cdn.datatables.net/1.10.19/js/jquery.dataTables.min.js"></script>

<script src="https://cdn.datatables.net/plug-ins/1.10.19/api/sum().js"></script>



<script src="https://cdn.datatables.net/1.10.19/js/dataTables.bootstrap4.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.6-rc.0/js/select2.min.js"></script>

<script src="<?php echo $module->getUrl("js/redcap_data_dupes.js") ?>"></script>

<script>
    // var dc = dc || {};
    dc.endpointUrl = '<?php echo $module->getUrl("pages/ajax.php") ?>';
</script>



<main role="main" class="container">
    <div class="redcap-data-dedupes">


        <div class="card">
            <div class="card-header">
                <h4><?php echo $module->getModuleName() ?></h4>
            </div>
            <div class="card-body">
                <h4>REDCap Data Duplicates</h4>

                <div>
                    <p>This job scans redcap_data project-by-project to detect duplicate record entries.</p>
                    <ul>
                        <li>Having a backup is a REALLY good idea - this tool offers sufficient rope to hang yourself!</li>
                    </ul>
                </div>
            </div>
        </div>
        <div>
            <p>
                Step 1: Scan your REDCap data table for projects with repeat rows.  This could take a while...
            </p>
            <p>
                <button class="btn btn-primaryrc btn-sm" data-action="scan-projects">Scan All Projects</button>
            </p>
        </div>
        <div>
            <div class="progress hidden">
                <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 25%;" aria-valuenow="25" aria-valuemin="0" aria-valuemax="100">25%</div>
            </div>
        </div>

        <div class="dataTable-container hidden">
            <hr>
            <table id="projects-table" class="table table-striped table-bordered" style="width:100%">
                <thead>
                    <tr>
                        <th>PID</th>
                        <th>Title</th>
                        <th>Total Rows</th>
                        <th>Unique Rows</th>
                        <th>Duplicates</th>
                        <th>Query(ms)</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        </div>

    </div>
</main>

<div class="modal waiting-modal fade load-spinner" data-backdrop="static" data-keyboard="false" tabindex="-1">
    <div class="modal-dialog modal-sm">
        <div class="modal-content" style="width: 48px">
            <span class="fa fa-spinner fa-spin fa-3x"></span>
        </div>
    </div>
</div>


<style>
    /*#project_select { width: 100%; }*/

    /*Clean up bootstrap formatting for datatables*/
    table.dataTable thead .sorting_asc, table.dataTable thead .sorting_desc, table.dataTable thead .sorting {background-image: none;}

    .load-spinner .modal-dialog{
        display: table;
        position: relative;
        margin: 0 auto;
        top: calc(33% - 24px);
    }

    .load-spinner .modal-dialog .modal-content{
        background-color: transparent;
        border: none;
    }

    .left-20 {
        margin-left: 20px;
    }

    .table-summary .badge {
        margin-right: 10px;
        font-size: 100%;
    }
</style>
