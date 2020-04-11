$(document).ready( function() {
    dc.init();
});



// Data Cleanup javascript class
var dc = dc || {};

dc.init = function() {

    dc.projects = [];
    dc.analysisQueue = [];

    // Bind buttons
    $('.container').on('click', 'button', dc.buttonPress);

    // Table Columns
    dc.columns = [
        {
            title: "PID"
        },
        {
            title: "Title"
        },
        {
            title: "Potential Collisions"
        },
        {
            title: "Records Affected"
        },
        {
            title: "Query Time(ms)"
        },
        {
            title: "Cache Date"
        },
        {
            title: "Actions"
        }
    ];

    let tr = $('#projects-table>thead>tr');
    $.each(dc.columns, function(i, j) {
        tr.append($('<th>'+ j.title + '</th>'));
    });

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
        .append("<button id='collision-filter-on' class='ml-2 btn btn-xs btn-success' data-action='collision-filter-on'>Show Collisions Only</button>")
        .append("<button id='collision-filter-off' class='ml-2 btn btn-xs btn-primary hidden' data-action='collision-filter-off'>Show All Projects</button>");
};

/**
 * Bind buttons
 */
dc.buttonPress = function() {
    var action = $(this).data('action');

    dc.startProject = parseInt($('input[name="start-project"]').val(), 10);
    dc.endProject   = parseInt($('input[name="end-project"]').val(), 10);

    if (action === 'load-projects') {
        dc.loadProjects();
    }
    else if (action === 'scan-projects') {
        dc.scanProjects();
    }
    else if (action === 'clear-cache') {
        pid = $(this).data('pid');
        dc.clearCache(pid);
    }
    else if (action === 'analyze') {
        pid = $(this).data('pid');
        dc.analysisQueue.push(pid);
        dc.processAnalysisQueue();
    }
    else if (action === "view-details") {
        // Show Details
        pid = $(this).data('pid');
        dc.viewDetails(pid);
    }
    else if (action === "collision-filter-on") {
        regExSearch = '[^0-]+';
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

/**
 * Load projects from server/cache and populate table
 * Does not do any re-checks
 */
dc.loadProjects = function() {
    dc.hideDataTable();
    dc.dataTable.clear();
    dc.showWaitingModal();
    dc.ajax({"action": "load-projects"}, dc.loadProjectsResult);
};
dc.loadProjectsResult = function(result) {
    console.log("loadProjectsResult",result);
    for (let key in result) {
        if (result.hasOwnProperty(key) && ! isNaN(key)) {
            let pid = key;

            // Add row to table
            dc.addRow(result[key]);
            }
        }
    dc.hideWaitingModal();
    dc.dataTable.draw();
    dc.showDataTable();
    dc.updateSummary();
    dc.showStep(2);
};



/**
 * Loop through table and scan those projects that are not yet scanned
 */
dc.scanProjects = function() {
    dc.analysisQueue = [];
    for (let pid in dc.projects) {
        if (dc.projects.hasOwnProperty(pid) && ! isNaN(pid)) {
            const project = dc.projects[pid];
            if(!isNaN(dc.startProject) && parseInt(pid,10) < dc.startProject) continue;
            if(!isNaN(dc.endProject)   && parseInt(pid,10) > dc.endProject)   continue;
            if(project.hasOwnProperty('analysis')) {
                // Skip this one
                console.log('skipping');
            } else {
                dc.analysisQueue.push(pid);
            }
        }
    }
    dc.processAnalysisQueue();
};

/**
 * This function starts the analysis Queue
 * It then calls analyzeProject which has a callback to analyzeProjectResults
 * This handles the ajax results and then repeats until the queue is empty.
 */
dc.processAnalysisQueue = function() {

    dc.analysisCount = dc.analysisQueue.length;
    dc.analysisIndex = 0;
    console.log("Before", dc.analysisQueue);

    if(dc.analysisCount == 0) {
        // Nothing to process
    } else {
        dc.scanStart = new Date();
        dc.updateProgressBar(0);
        dc.showProgressModal();
        dc.analyzeProject();
    }
};
dc.analyzeProject = function() {
    if (dc.analysisQueue.length === 0) {
        console.log("Queue Empty");
        dc.hideWaitingModal();
        dc.hideProgressModal();
        dc.dataTable.draw();
        dc.showDataTable();
        dc.updateSummary();
        return true;
    }
    pid = dc.analysisQueue.shift();
    dc.ajax({action: "analyze-project", project_id: pid}, dc.analyzeProjectResults);
};
dc.analyzeProjectResults = function(result) {
    // Save result to project
    let project = dc.projects[pid];
    project.analysis = result;

    // Add row to table
    dc.addRow(project)

    // Update progress
    dc.analysisIndex++;
    let percent = Math.round((((dc.analysisCount - dc.analysisQueue.length) / dc.analysisCount)) * 100);
    dc.updateProgressBar(percent, percent + "% (" + dc.analysisIndex + "/" + dc.analysisCount + ")");

    // Get next queue member
    dc.analyzeProject()
};


/**
 * Clear the server cache for project or all projects
 * @param pid. * means all with start/end project
 */
dc.clearCache = function(pid) {
    dc.showWaitingModal();
    dc.actionStart = new Date();
    const data = {
        "action": "clear-cache",
        "project_id": pid,
        "start_project": dc.startProject,
        "end_project": dc.endProject
    };

    dc.ajax(data, dc.clearCacheResult);
};
dc.clearCacheResult = function(result) {
    if (result === false) {
        dc.hideWaitingModal();
        dc.addAlert("There was an error clearing the cache.  Check logs");
    } else {
        let duration = +((new Date() - dc.actionStart) / 1000).toFixed(1);
        console.log("Clear Cache Result", result, pid);
        if (pid && !isNaN(pid)) {
            // We are doing just one project - let's re-scan that project
            dc.addAlert("<strong>Success</strong> Project " + pid + "'s cache was cleared in " + duration + " seconds.  Reanalyzing...", "alert-success");
            dc.analysisQueue.push(pid);
            dc.processAnalysisQueue();
        } else {
            console.log('b');
            // We cleared all projects
            dc.addAlert("<strong>Success</strong> " + result + " caches were cleared in " + duration + " seconds.  Reloading Projects.", "alert-success");
            dc.hideWaitingModal();
            dc.loadProjects();
        }
    }
};


dc.viewDetails = function(pid) {
    dc.showWaitingModal();
    dc.ajax({"action":"view-details", "project_id":pid}, dc.viewDetailsResult);
};
dc.viewDetailsResult = function(results) {
    dc.hideWaitingModal();
    console.log("viewDetailsResult", results);
    dc.addAlert("<b>Execute the following SQL on your server and compare the data values columns:</b><pre class='sql'>" + results + "</pre>",'alert-success');
};


/**
 * Add a row to the datatable
 * You may need to adjust the columns here
 * @param project
 */
dc.addRow = function(project) {
    // console.log(project);

    // Cache the project row
    dc.projects[project.pid] = project;

    // Build each column for the table
    const pk = "<a href='" + app_path_webroot + "?pid=" + project.pid + "' target='_BLANK'>" + project.pid + "</a>";
    const title = project.title;

    const analysis = project.hasOwnProperty('analysis') ? project.analysis : false;
    const collisions = analysis ? analysis.collisions : "-";
    const records    = analysis ? analysis.records : "-";
    const duration   = analysis ? analysis.duration : null;
    const cache_date = analysis ? analysis.cache_date : "";


    let actions = "";

    if(cache_date == "") {
        actions = actions + "<button class='btn btn-xs btn-primary' data-action='analyze' data-pid='" + project.pid + "'>Analyze</button>";
    } else {
        actions = actions + "<button class='btn btn-xs btn-secondary' data-action='analyze' data-pid='" + project.pid + "'>Refresh</button>";
    }
    if(collisions > 0) {
        actions = actions + "<button class='ml-2 btn btn-xs btn-success' data-action='view-details' data-pid='" + project.pid + "'>Details</button>";
    }

    // Remove the row if it already exists
    let existingRow = $("#projects-table tr").filter(function() {
        return $('td:first', this).text() == project.pid;
    });
    if (existingRow.length) {
        // Subtract from totals
        console.log ("Removing row " + project.pid);
        dc.dataTable.row(existingRow).remove();
    }

    dc.dataTable.row.add(
        [
            pk,
            title,
            collisions,
            records,
            duration,
            cache_date,
            actions
        ]
    );

    if (collisions) dc.collisionCount += collisions;
    if (records) dc.recordCount       += records;
    dc.dataTable.draw();
};

/**
 * AJAX Helper
 * @param data
 * @param callback
 */
dc.ajax = function (data, callback) {
    $.ajax({
        method: "POST",
        url: dc.endpointUrl,
        dataType: 'json',
        data: data, //{ action: "get-all-projects"}
    }).done( function(result) {
        callback(result);
    }).always( function() {
    });
};


dc.showStep = function(num) {
    $('div.step'+num).show();
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



dc.formatNumberWithCommas = function(x) {
    var parts = x.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
};


dc.updateSummary = function() {
    let project_count = dc.dataTable.data().length;

    console.log(dc.dataTable.columns(2).data() );

    // Convert column to numerical sum
    let collisions  = dc.dataTable.columns(2).data()[0].reduce( function(a,b) {
        return ( isNaN(a) ? 0 : parseFloat(a) ) + ( isNaN(b) ? 0 : parseFloat(b) );
    });

    let records  = dc.dataTable.columns(3).data()[0].reduce( function(a,b) {
        return ( isNaN(a) ? 0 : parseFloat(a) ) + ( isNaN(b) ? 0 : parseFloat(b) );
    });

    let db_time  = dc.dataTable.columns(3).data()[0].reduce( function(a,b) {
        return ( isNaN(a) ? 0 : parseFloat(a) ) + ( isNaN(b) ? 0 : parseFloat(b) );
    });

    // var duration    = (new Date - dc.scanStart) / 1000;

    console.log(collisions);
    console.log(records);

    $('div.table-summary').remove();
    var ts = $('<div class="table-summary"/>')
        // .prepend("<span class='badge badge-secondary'>" + dc.formatNumberWithCommas(+(duration/60).toFixed(1)) + "min</span>")
        .append("<span class='badge badge-dark'>" + dc.formatNumberWithCommas(project_count) + " Projects</span>")
        .append("<span class='badge badge-danger'>" + dc.formatNumberWithCommas(collisions) + " Possible Collisions Found</span>")
        .append("<span class='badge badge-info'>" + dc.formatNumberWithCommas(records) + " Records Affected</span>")
        .append("<hr>");

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

