<?php
namespace Stanford\DatabaseCleanup;
/** @var DatabaseCleanup $module */

require APP_PATH_DOCROOT . "ControlCenter/header.php";

if (!SUPER_USER) {
    ?>
    <div class="jumbotron text-center">
        <h3><span class="glyphicon glyphicon-exclamation-sign"></span> This utility is only available for REDCap Administrators</h3>
    </div>
    <?php
    exit();
}


?>

<link href="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.6-rc.0/css/select2.min.css" rel="stylesheet" />
<link href="https://cdn.datatables.net/1.10.19/css/dataTables.bootstrap4.min.css" rel="stylesheet" />

<script src="https://cdn.datatables.net/1.10.19/js/jquery.dataTables.min.js"></script>

<script src="https://cdn.datatables.net/plug-ins/1.10.19/api/sum().js"></script>

<script src="https://cdn.datatables.net/1.10.19/js/dataTables.bootstrap4.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.6-rc.0/js/select2.min.js"></script>

<script src="<?php echo $module->getUrl("js/redcap_data_dupes.js") ?>"></script>

<script>
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
                    <p>This job scans redcap_data project-by-project to detect duplicate record entries.  Once found, you can 'repair' them and remove
                    the duplicate entries.</p>
                    <ul>
                        <li>Having a backup is a REALLY good idea - this tool offers sufficient rope to hang yourself!</li>
                        <li>The scanning process was throttled to a single thread to reduce the impact on your database.  This means it may take
                            a long time to scan your entire redcap_data table, but other users should be able to continue using the system with
                            an acceptable impact to performance.</li>
                        <li>
                            I would recommend testing this on a dev/backup database first.  I AM NOT RESPONSIBLE FOR DELETION OF DATA!
                        </li>
                        <li>
                            Obviously, since this is done as a transaction, any writes to the table while it is running
                            would be lost so it is a good idea to only do this when webapp is in offline mode
                        </li>
                    </ul>
                </div>
            </div>
        </div>
        <div class="step1">
            <p>
                <b>Step 1:</b> Scan your REDCap data table for projects with repeat rows.  This could take a while...
            </p>
            <p>
                <button class="btn btn-primaryrc btn-sm" data-action="scan-projects">Scan All Projects</button>
            </p>
        </div>

        <div class="progress hidden" style="height: 30px;">
            <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 25%; height: 100%;" aria-valuenow="25" aria-valuemin="0" aria-valuemax="100">25%</div>
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
                        <th>Query (ms)</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        </div>

    </div>
</main>


<div id="spinnerModal" class="modal waiting-modal fade load-spinner" data-backdrop="static" data-keyboard="false" tabindex="-1">
    <div class="modal-dialog modal-sm">
        <div class="modal-content" style="width: 48px">
            <span class="fa fa-spinner fa-spin fa-3x"></span>
        </div>
    </div>
</div>


<div id="progressModal" class="modal fade" data-backdrop="static" role="dialog" data-keyboard="false" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h4 class="modal-title">Please Wait</h4>
            </div>
            <div class="modal-body center-block">
                <div class="progress" style="height:30px;">
                    <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width:25%; height:100%;">25%</div>
                </div>
            </div>
<!--            <div class="modal-footer">-->
<!--                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>-->
<!--            </div>-->
        </div><!-- /.modal-content -->
    </div><!-- /.modal-dialog -->
</div><!-- /.modal -->


<style>
    /*#project_select { width: 100%; }*/

    /*Clean up bootstrap formatting for datatables*/
    table.dataTable thead .sorting_asc, table.dataTable thead .sorting_desc, table.dataTable thead .sorting {background-image: none;}


    #pagecontainer { max-width: inherit; }

    #projects-table td {
        /*font-size: 80%;*/
    }

    .progress {
        font-size: 1.0rem;
    }

    .alert {
        border-color: transparent !important;
    }

    .load-spinner .modal-dialog{
        display: table;
        position: relative;
        margin: 0 auto;
        top: calc(33% - 24px);
    }

    .fa-3x {
        font-size: 4em;
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
