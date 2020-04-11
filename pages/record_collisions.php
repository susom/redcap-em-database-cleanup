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

<script src="<?php echo $module->getUrl("js/redcap_collisions.js") ?>"></script>

<script>
    dc.endpointUrl = '<?php echo $module->getUrl("pages/record_collisions_ajax.php") ?>';
</script>

<main role="main" class="container">
    <div class="redcap-data-dedupes">

        <div class="card">
            <div class="card-header">
                <h4><?php echo $module->getModuleName() ?></h4>
            </div>
            <div class="card-body">
                <h4>REDCap Record Collisions</h4>
                <div>
                    <p>This job scans redcap_data project-by-project to detect record collisions where two different users might be saving data to the same record id.
                    </p>
                    <ul>
                        <li>Having a backup is a REALLY good idea - this tool offers sufficient rope to hang yourself!</li>
                        <li>The scanning process was throttled to a single thread to reduce the impact on your database.
                            This means it may take a long time to scan your entire redcap_data table, but other users
                            should be able to continue using the system with an acceptable impact to performance.</li>
                        <li>The scan stores a cache of the result in the external module settings table.  So, if you do
                            not finish in one session, you can restart and it will quickly catch up to where you left
                            off using the cached values.</li>
                        <li>
                            You might want to enable your browser 'debugger tools' and follow the console to see how the
                            process is going before hitting the 'Scan All Projects' button.
                        </li>
                    </ul>
                </div>
            </div>
        </div>
        <div class="step1">
            <p>
                <b>Step 1:</b> Load the list of projects (and any cached results you may have previously done)  If you have a large
                installation and a large cache, this step can take minutes to complete...  Be patient!
            </p>
            <div class="input-group input-group-sm mb-3">
                <button class="mr-4 btn btn-primaryrc btn-sm" data-action="load-projects">Load Project Table (with Cached Results)</button>
            </div>
        </div>
        <div class="step2 hidden">
            <p>
                <b>Step 2:</b> Scan all un-scanned projects (storing results in cache along the way) or a subset or projects.
                Any projects with cached results will be skipped.  Please Start and End blank to scan all.
            </p>
            <div class="input-group input-group-sm mb-3">
                <input class="mr-3 form-control" name="start-project" placeholder="Start PID (optional)"/>
                <input class="mr-3 form-control" name="end-project" placeholder="End PID (optional)"/>
                <button class="mr-3 btn btn-primaryrc btn-sm" data-action="scan-projects">Analyze Uncached Projects</button>
                <button class="btn btn-danger btn-sm" data-pid="*" data-action="clear-cache">Delete Cache for Select Projects</button>
            </div>
        </div>

<!--            <p>-->
<!--                You can clear the cache for records one-at-a-time to rescan or clear all at once-->
<!--                <button class="btn btn-primaryrc btn-sm" data-action="clear-cache">Clear Cache For All Records</button>-->
<!--            </p>-->

        <div class="progress hidden" style="height: 30px;">
            <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 25%; height: 100%;" aria-valuenow="25" aria-valuemin="0" aria-valuemax="100">25%</div>
        </div>

        <div class="dataTable-container hidden">
            <hr>
            <table id="projects-table" class="table table-striped table-bordered" style="width:100%">
                <thead>
                    <tr>
<!--                        <th>PID</th>-->
<!--                        <th>Title</th>-->
<!--                        <th># Collisions</th>-->
<!--                        <th># Records</th>-->
<!--                        <th>Query (ms)</th>-->
<!--                        <th>Cached</th>-->
<!--                        <th>Action</th>-->
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
        </div><!-- /.modal-content -->
    </div><!-- /.modal-dialog -->
</div><!-- /.modal -->


<style>
    /*#project_select { width: 100%; }*/

    /*Clean up bootstrap formatting for datatables*/
    table.dataTable thead .sorting_asc, table.dataTable thead .sorting_desc, table.dataTable thead .sorting {background-image: none;}

    #pagecontainer { max-width: inherit; }

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

    .table-summary .badge {
        margin-right: 10px;
        font-size: 100%;
    }

    #projects-table td {
        font-size: 12px;
    }

    pre.sql {
        white-space: pre-wrap;
        font-size: 7pt;
    }
</style>
