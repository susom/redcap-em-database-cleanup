// Data Cleanup javascript class
var dc = dc || {};

dc.init = function() {

    // Bind buttons
    $('.container').on('click', 'button', dc.buttonPress);

    // Set up the datatable
    dc.dataTable = $('#projects-table').DataTable({
        "order": [[ 4, "desc" ]],
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
        .append("<button id='dupes-filter-on' class='left-20 btn btn-xs btn-success' data-action='dupes-filter-on'>Show Dupes Only</button>")
        .append("<button id='dupes-filter-off' class='left-20 btn btn-xs btn-primary hidden' data-action='dupes-filter-off'>Show All Projects</button>");


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
        dc.showWaitingModal();
        dc.hideDataTable();
        var projects = dc.getAllProjects();
    }
    else if (action === "dedup") {
        pid = $(this).data('pid');
        dc.deduplicate(pid);
    }
    else if (action === "dupes-filter-on") {
        regExSearch = '[^0]+';
        dc.dataTable.column(4).search(regExSearch, true, false).draw();
        $('#dupes-filter-off').show();
        $('#dupes-filter-on').hide();
    }
    else if (action === "dupes-filter-off") {
        regExSearch = '';
        dc.dataTable.column(4).search(regExSearch, true, false).draw();
        $('#dupes-filter-off').hide();
        $('#dupes-filter-on').show();
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

dc.showProgressBar = function() {
    $('.progress').show();
};

dc.hideProgressBar = function() {
    $('.progress').hide();
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
    $.ajax({
        method: "POST",
        url: dc.endpointUrl,
        dataType: 'json',
        data: { action: "get-all-projects"},
    }).done( function(result) {
        // Result is a single object - let's break it down into an array
        dc.projects = [];
        for (var key in result) {
            if (result.hasOwnProperty(key) && ! isNaN(key)) {
                var pid = key;
                var title = result[key];
                console.log(pid + " -> " + title);
                dc.projects[pid] = {
                    pid: pid,
                    title: title
                };
            }
        }
        dc.analyzeProjects();
    }).always( function() {
        //dc.hideWaitingModal();
    });
};

dc.analyzeProjects = function() {
    dc.updateProgressBar(0);
    dc.showProgressBar();
    dc.projectCount = dc.projects.length - 1; //Object.keys(dc.allProjects).length;
    dc.projectIndex = 0;
    dc.duplicateCount = 0;
    dc.recordCount = 0;
    for (var key in dc.projects) dc.analyzeProject(key);
};

dc.analyzeProject = function(pid) {
    $.ajax({
        method: "POST",
        url: dc.endpointUrl,
        dataType: 'json',
        data: { action: "analyze-project", project_id: pid},
    }).done( function(result) {
        console.log(pid, result);
        var project = dc.projects[pid];
        project.analysis = result;
        // dc.projects[pid] = result;
        dc.addRow(project)
    }).always( function() {
        dc.projectIndex++;
        var percent = Math.round( dc.projectIndex / dc.projectCount * 100, 0);
        dc.updateProgressBar(percent, percent + "% (" + dc.projectIndex + "/" + dc.projectCount + ")");
        if (percent == 100) {
            dc.hideWaitingModal();
            dc.hideProgressBar();
            dc.dataTable.draw();
            dc.showDataTable();
            dc.updateSummary();
        }
    });
};


dc.updateSummary = function() {
    var total = dc.dataTable.columns(2).data().sum();
    var unique = dc.dataTable.columns(3).data().sum();
    var duplicates = dc.dataTable.columns(4).data().sum();
    var duration = dc.dataTable.columns(5).data().sum();

    console.log(total,unique,duplicates,duration);

    var ts = $('<div class="table-summary"/>')
        .prepend("<span class='badge badge-secondary'>" + Number.parseFloat(duration/1000).toPrecision(3) + " sec DB Query Time</span>")
        .prepend("<span class='badge badge-danger'>" + duplicates + " Duplicates</span>")
        .prepend("<span class='badge badge-primary'>" + unique + " Unique Rows</span>")
        .prepend("<span class='badge badge-secondary'>" + total + " Total Rows</span>")

    $('.dataTable-container')
        .prepend(ts)
        .prepend("<hr>");
};

dc.addRow = function(project) {

    var action = "";
    if(project.analysis.duplicates > 0) {
        action = "<button class='btn btn-xs btn-primary' data-action='dedup' data-pid='" + project.pid + "'>Remove Duplicates</button>";
    } else if (project.dedup === true) {
        action = "<i class='fas fa-check-circle'></i> Cleaned";
    }

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
            project.pid,
            project.title,
            project.analysis.total,
            project.analysis.distinct,
            project.analysis.duplicates,
            project.analysis.duration,
            action
        ]
    );

    dc.duplicateCount =+ project.analysis.duplicates;
    dc.totalCount =+ project.analysis.total;

    dc.dataTable.draw();
};


dc.deduplicate = function(pid) {
    dc.showWaitingModal();
    $.ajax({
        method: "POST",
        url: dc.endpointUrl,
        dataType: 'json',
        data: { action: "dedup-project", project_id: pid},
    }).done( function(result) {
        console.log(pid, result);
        var project = dc.projects[pid];
        project.dedup = result;
        if (result === false) {
            alert ("There was an error cleaning up project " + pid);
        } else {
            dc.analyzeProject(pid);
        }
    }).always( function() {
        dc.hideWaitingModal();
    });
};



// // Go through and set up all the rows in the data-table
// function updateDataTable() {
//     // Clear the current table
//     var table = $('#projects-table').DataTable();
//     // table
//     //     .clear();
//
//     // Get the selected project
//     var selected = $('#project_select').select2('data');
//
//     console.log(selected);
//
//     var project_id = selected[0].id;
//     var project_text = selected[0].text;
//     console.log("On project " + project_id, project_text);
//
//
//
//
//     table.row.add([project_id, project_text, null,null,null,null]).draw(true);
//
//     // analyzeProject(project_id);
//
// }


// function analyzeProject(project_id) {
//     $.ajax({
//         method: "POST",
//         url: '<?php echo $module->getUrl("pages/ajax.php") ?>',
//         dataType: 'json',
//         data: { action: "analyze", project_id: project_id },
//     }).done( function(result) {
//         console.log(result);
//         // var table = $('#projects-table').DataTable();
//         // table.row.add(result.project_id, result.)
//
//
//     });
// }
//
// $('div.actions .btn').bind('click', function() {
//     var action = $(this).data('action');
//     console.log(action);
//
//     // Get the project_id
//     var project_id = $('#project_select').val();
//     if (project_id == '') {
//         alert ('You must select a valid project option');
//         return false;
//     }
//
//
//     // Analyze
//     if (action === "analyze") {
//         $.ajax({
//             method: "POST",
//             url: '<?php echo $module->getUrl("pages/ajax.php") ?>',
//             dataType: 'json',
//             data: { action: action, project_id: project_id },
//         }).done( function(result) {
//             console.log(result);
//         });
//     }
//
//
// });

$(document).ready( function() {
    dc.init();
});