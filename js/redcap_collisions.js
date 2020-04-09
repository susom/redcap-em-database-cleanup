$(document).ready( function() {
    dc.init();
});



// Data Cleanup javascript class
var dc = dc || {};

dc.init = function() {

    // Bind buttons
    $('.container').on('click', 'button', dc.buttonPress);

    // Set up the datatable
    dc.dataTable = $('#projects-table').DataTable({
        "order": [[ 3, "desc" ]],
        // "columns": [
        //     { "width": "10%" },
        //     { "width": "40%" },
        //     { "width": "10%" },
        //     { "width": "10%" },
        //     { "width": "10%" },
        //     { "width": "10%" },
        //     { "width": "10%" }
        // ],
        // "columnDefs": [
        //     { "width": "10%", "targets": 0 },
        //     { "width": "40%", "targets": 0 },
        //     { "width": "10%", "targets": 0 },
        //     { "width": "10%", "targets": 0 },
        //     { "width": "10%", "targets": 0 },
        //     { "width": "10%", "targets": 0 },
        //     { "width": "10%", "targets": 0 }
        // ]
    });

    $('.dataTables_length')
        .append("<button id='collision-filter-on' class='left-20 btn btn-xs btn-success' data-action='collision-filter-on'>Show Collisions Only</button>")
        .append("<button id='collision-filter-off' class='left-20 btn btn-xs btn-primary hidden' data-action='collision-filter-off'>Show All Projects</button>");


    // // Set up the Select2 control
    // $('#project_select').select2({
    //     allowClear: true,
    //     ajax: {
    //         url: '<?php echo $module->getUrl("pages/ajax.php") . "&getProjects" ?>',
    //         dataType: 'json',
    //         delay: 250,         // wait 250ms before trigging ajax call
    //         cache: true,
    //         processResults: function (data) {
    //             return {
    //                 results: data.results
    //             };
    //         }
    //     },
    //     placeholder: 'Select a Project',
    // }).bind('change',function() {
    //     console.log( "Val Changed");
    //     updateDataTable();
    // });

};


dc.buttonPress = function() {
    var action = $(this).data('action');

    if (action === "scan-projects") {
        var projects = dc.getAllProjects();
    }
    else if (action === 'clear-cache') {
        pid = $(this).data('pid');
        dc.clearCache(pid);
    }
    // else if (action === "detail") {
    //     // Show Details
    //     pid = $(this).data('pid');
    //     dc.deduplicate(pid);
    // }
    else if (action === "collision-filter-on") {
        regExSearch = '[^0]+';
        dc.dataTable.column(3).search(regExSearch, true, false).draw();
        $('#collision-filter-off').show();
        $('#collision-filter-on').hide();
    }
    else if (action === "collision-filter-off") {
        regExSearch = '';
        dc.dataTable.column(3).search(regExSearch, true, false).draw();
        $('#collision-filter-off').hide();
        $('#collision-filter-on').show();
    }
    else {
        console.log(this, 'unregistered buttonPress', action);
    }
};


dc.showWaitingModal = function() {
    $('.waiting-modal').modal('show');
};

dc.hideWaitingModal = function() {
    $('.waiting-modal').modal('hide');
};

dc.showProgressModal = function() {
    $('#progressModal').modal('show');
};

dc.hideProgressModal = function() {
    $('#progressModal').modal('hide');
};

dc.showDataTable = function() {
    $('.dataTable-container').show();
};

dc.hideDataTable = function() {
    $('.dataTable-container').hide();
};

dc.updateProgressBar = function(percent, text) {
    text = text || (percent + "%");

    $('.progress-bar')
        .css({width: percent + "%"})
        .text(text);
};


// Get all the projects in the system
dc.getAllProjects = function() {
    dc.hideDataTable();
    dc.dataTable.clear();

    dc.startProject = parseInt($('input[name="start-project"]').val(), 10);
    dc.endProject   = parseInt($('input[name="end-project"]').val(), 10);

    $.ajax({
        method: "POST",
        url: dc.endpointUrl,
        dataType: 'json',
        data: { action: "get-all-projects"},
    }).done( function(result) {
        // Result is a single object - let's break it down into an array
        dc.projects = [];

        for (let key in result) {
            if (result.hasOwnProperty(key) && ! isNaN(key)) {
                let pid = key;

                if(!isNaN(dc.startProject) && parseInt(pid,10) < dc.startProject) continue;
                if(!isNaN(dc.endProject)   && parseInt(pid,10) > dc.endProject)   continue;

                let title = result[key];
                // console.log(pid + " -> " + title);
                dc.projects[pid] = {
                    pid: pid,
                    title: title
                };
            }
        }
        dc.processAnalysisQueue();
    }).always( function() {
        //dc.hideWaitingModal();
    });
};


dc.processAnalysisQueue = function() {
    dc.scanStart = new Date();

    dc.updateProgressBar(0);
    dc.showProgressModal();
    // dc.projectCount = dc.projects.length - 1; //Object.keys(dc.allProjects).length;

    // for (var key in dc.projects) dc.analyzeProject(key);
    dc.analysisQueue = [];
    for (var key in dc.projects) {
        if (key != "") dc.analysisQueue.push(key);
    }

    dc.projectCount=dc.analysisQueue.length;
    dc.projectIndex = 0;

    dc.analyzeProject();
};


dc.analyzeProject = function() {
    if (dc.analysisQueue.length === 0) {
        console.log("Queue Empty");
        return true;
    }

    var pid = dc.analysisQueue.shift();

    $.ajax({
        method: "POST",
        url: dc.endpointUrl,
        dataType: 'json',
        data: { action: "analyze-project", project_id: pid},
    }).done( function(result) {
        console.log(pid, result);

        // Save result to project
        var project = dc.projects[pid];
        project.analysis = result;

        // Add row to table
        dc.addRow(project)
    }).always( function() {
        dc.projectIndex++;
        var percent = Math.round(( ((dc.projectCount - dc.analysisQueue.length) / dc.projectCount)) * 100, 0);
        // var percent = Math.round( dc.projectIndex / dc.projectCount * 100, 0);

        dc.updateProgressBar(percent, percent + "% (" + dc.projectIndex + "/" + dc.projectCount + ")");

        if (dc.analysisQueue.length === 0) {
            dc.hideWaitingModal();
            dc.hideProgressModal();
            dc.dataTable.draw();
            dc.showDataTable();
            dc.updateSummary();
        } else {
            // Get next queue member
            dc.analyzeProject()
        }
    });
};


dc.formatNumberWithCommas = function(x) {
    var parts = x.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
};


dc.updateSummary = function() {
    var collisions  = dc.dataTable.columns(2).data().sum();
    var records     = dc.dataTable.columns(3).data().sum();
    var db_time     = dc.dataTable.columns(4).data().sum();
    var duration    = (new Date - dc.scanStart) / 1000;

    var project_count = dc.dataTable.data().length;

    // console.log(total,unique,duplicates,duration);

    $('div.table-summary').remove();
    var ts = $('<div class="table-summary"/>')
        .prepend("<span class='badge badge-secondary'>" + dc.formatNumberWithCommas(+(duration/60).toFixed(1)) + "min</span>")
        .prepend("<span class='badge badge-info'>" + dc.formatNumberWithCommas(records) + " Records Affected</span>")
        .prepend("<span class='badge badge-dark'>" + dc.formatNumberWithCommas(project_count) + " Projects</span>")
        .prepend("<span class='badge badge-danger'>" + dc.formatNumberWithCommas(collisions) + " Possible Collisions Found</span>")
        .prepend("<hr>");

    $('.dataTable-container')
        .prepend(ts);
};


dc.addAlert = function (msg, alertType) {
    alertType = alertType || "alert-danger";

    $('<div id="update-alert" class="alert ' + alertType + ' alert-dismissible fade show">')
        .html(msg)
        .prepend('<button type="button" class="close" data-dismiss="alert">&times;</button>')
        .insertAfter('div.step1');
};


dc.addRow = function(project) {
    console.log(project);

    let action = "";
    if(project.analysis.collisions > 0) {
        action += "<button class='btn btn-xs btn-primary' data-action='viewDetails' data-pid='" + project.pid + "'>Details</button>";
    }

    let cacheBtn = "<button class='ml-2 btn btn-xs btn-danger' data-action='clear-cache' data-pid='" + project.pid + "'>Clear</button>";



    // else if (project.dedup === true) {
    //     action = "<i class='fas fa-check-circle'></i> Cleaned";
    // }

    // Remove the row if it already exists
    var existingRow = $("#projects-table tr").filter(function() {
        return $('td:first', this).text() == project.pid;
    });

    if (existingRow.length) {
        // Subtract from totals
        console.log ("Removing row " + project.pid);
        dc.dataTable.row(existingRow).remove();
    }

    dc.dataTable.row.add(
        [
            "<a href='" + app_path_webroot + "?pid=" + project.pid + "' target='_BLANK'>" + project.pid + "</a>",
            project.title,
            project.analysis.collisions,
            project.analysis.records,
            project.analysis.duration,
            project.analysis.cache + cacheBtn,
            action
        ]
    );

    dc.collisionCount =+ project.analysis.collisions;
    dc.recordCount    =+ project.analysis.records;
    dc.dataTable.draw();
};



dc.clearCache = function(pid) {
    dc.showWaitingModal();
    dc.actionStart = new Date();

    $.ajax({
        method: "POST",
        url: dc.endpointUrl,
        dataType: 'json',
        data: { action: "clear-cache", project_id: pid},
    }).done( function(result) {
        if (result === false) {
            dc.hideWaitingModal();
            alert ("There was an error clearing the cache for project: " + pid);
        } else {
            let duration = +((new Date() - dc.actionStart) / 1000).toFixed(1);
            if (pid) {
                // We are doing just one project - let's re-scan that project
                dc.addAlert("<strong>Success</strong> Project " + pid + "'s cache was cleared in " + duration + " seconds.  Reanalyzing...", "alert-success");
                dc.analysisQueue.push(pid);
                dc.analyzeProject(pid);
            } else {
                // We cleared all projects
                dc.addAlert("<strong>Success</strong> All project caches were cleared in " + duration + " seconds.  Select projects to re-analyze.", "alert-success");
                dc.hideWaitingModal();
            }
        }
    }).always( function() {
        // dc.hideWaitingModal();
    });
};



// dc.deduplicate = function(pid) {
//     dc.showWaitingModal();
//     dc.dedupStart = new Date();
//
//     $.ajax({
//         method: "POST",
//         url: dc.endpointUrl,
//         dataType: 'json',
//         data: { action: "dedup-project", project_id: pid},
//     }).done( function(result) {
//         console.log(pid, result);
//         var project = dc.projects[pid];
//         project.dedup = result;
//         if (result === false) {
//             dc.hideWaitingModal();
//             alert ("There was an error cleaning up project " + pid);
//         } else {
//             var duration = +((new Date() - dc.dedupStart) / 1000).toFixed(1);
//             dc.addAlert("<strong>Success</strong> Project " + pid + " has been deduplicated in " + duration + " seconds", "alert-success");
//             dc.analysisQueue.push(pid);
//             dc.analyzeProject(pid);
//         }
//     }).always( function() {
//         // dc.hideWaitingModal();
//     });
// };

