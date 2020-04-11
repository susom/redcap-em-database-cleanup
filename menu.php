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
<script src="https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.6-rc.0/js/select2.min.js"></script>
<?php


?>
<form method="POST" id="form0" action="">
    <div class="card">
        <div class="card-header">
            <h4><?php echo $module->getModuleName() ?></h4>
        </div>
        <div class="card-body">
            <div>
                <p>This administrative module can help you clean up your database.  Please keep in mind the following:</p>
                <ul>
                    <li>Having a backup is a REALLY good idea - this tool offers sufficient rope to hang yourself!</li>
                    <li>Most steps can be done on a per-project basis or can be 'batched' across all projects</li>
                    <li>The code is sort of reusable so you can add your own 'cleanup' task by forking the repo -
                    please share back!</li>
                </ul>
            </div>

            <div>
                <button class="m-3 btn btn-primaryrc btn-sm"
                        onclick="location.href='<?php echo $module->getUrl("pages/redcap_data_dupes.php")?>'; return false;">
                    Remove Duplicate Records in REDCap Data
                </button>
            </div>

            <div>
                <button class="m-3 btn btn-primaryrc btn-sm"
                        onclick="location.href='<?php echo $module->getUrl("pages/record_collisions.php")?>';return false;">
                    Identify Record Collisions
                </button>
            </div>
<!--            <div class="input-group">-->
<!--                <span class="input-group-addon" id="project_label">Select a project:</span>-->
<!--                <select id="project_select"></select>-->
<!--            </div>-->
        </div>
    </div>
</form>

<style>
    #project_select { width: 100%; }
</style>

<script type="application/javascript">

    //$(document).ready( function() {
    //    // Set up the Select2 control
    //    $('#project_select').select2({
    //        allowClear: true,
    //        ajax: {
    //            url: '<?php //echo $module->getUrl("pages/ajax.php") . "&getProjects" ?>//',
    //            dataType: 'json',
    //            delay: 250,         // wait 250ms before trigging ajax call
    //            cache: true,
    //            processResults: function (data) {
    //                return {
    //                    results: data.results
    //                };
    //            }
    //        },
    //        placeholder: 'Select a Project',
    //    }).bind('change',function() { console.log( "Val Changed")});
    //});

</script>
