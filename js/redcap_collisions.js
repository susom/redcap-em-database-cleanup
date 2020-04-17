$(document).ready( function() {
    dc.init();
});



// Data Cleanup javascript class
var dc = dc || {};

dc.init = function() {

    dc.projects = [];
    dc.analysisQueue = [];
    dc.skipCache = false;

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
            title: "Likely Collisions"
        },
        {
            title: "Affected Records"
        },
        {
            // title: "Empty Records"
            title: "Pages"
        },
        {
            title: "Query Time(sec)"
        },
        {
            title: "Cache Timestamp"
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
        "order": [[ 2, "desc" ], [4, "desc"]],
        responsive: {
            details: {
                type: 'column',
                target: 'tr'
            }
        }
        // columnDefs: [ {
        //     className: 'details-control',
        //     orderable: false,
        //     data: null,
        //     defaultContent: ''
        // } ]
        //
        // "columnDefs": [ {
        //     "targets": -1,
        //     "data": null,
        //     "orderable": false,
        //     "className": 'details-control',
        //     "defaultContent": ''
        // } ]
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
    else if (action === 'analyze') {
        const pid = $(this).data('pid');
        dc.skipCache = $(this).data('skip-cache') == true;
        // console.log($(this).data('skip-cache'), dc.skipCache);
        dc.analysisQueue.push(pid);
        dc.processAnalysisQueue();
    }
    else if (action === 'clear-cache') {
        const pid = $(this).data('pid');
        dc.clearCache(pid);
    }


    else if (action === "view-details") {
        let pid = $(this).data('pid');
        let tr = $(this).closest('tr');
        // console.log("TR",tr.length,tr);
        // console.log(dc.dataTable.row(tr).child);

        if ( dc.dataTable.row(tr).child.isShown() ) {
            // This row is already open - close it
            dc.dataTable.row(tr).child.hide();
            // tr.removeClass('shown');
        }
        else {
            // Open this row
            dc.dataTable.row(tr).child.show();

            // toggle the raw_results in the next child row by default
            $('a.json-toggle:contains("raw_data")', tr.next()).not(".collapsed").trigger('click');
        }
        // const pid = $(this).data('pid');
        // dc.viewDetails(pid);
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
    const result_count = Object.keys(result).length;
    console.log("loaded " + result_count + " projects with cached results");

    for (let key in result) {
        if (result.hasOwnProperty(key) && ! isNaN(key)) {
            dc.addRow(result[key], true);
        }
    }

    dc.dataTable.draw();
    dc.showDataTable();
    dc.updateSummary();
    dc.showStep(2);

    // Sometimes this happens too fast so the hide doesn't register.  Adding a timeout.
    setTimeout(dc.hideWaitingModal, 100);
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
            if(project.hasOwnProperty('timestamp')) {
                // Skip this one - already cached
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
    dc.progressUpdate = 0;

    if(dc.analysisCount === 0) {
        // Nothing to process
    } else {
        dc.scanStart = new Date();
        dc.updateProgressBar(0);
        dc.showProgressModal(0);
        dc.analyzeProject();
    }
};
dc.analyzeProject = function() {
    if (dc.analysisQueue.length === 0) {
        console.log("Queue Empty");
        // For some reason, a timeout is needed to hide successfully in some cases
        setTimeout(function() {
            dc.hideWaitingModal();
            dc.hideProgressModal();
        }, 100);
        dc.dataTable.draw();
        dc.showDataTable();
        dc.updateSummary();
        dc.skipCache = false;   // reset to default behavior
        return true;
    }
    const project_id = dc.analysisQueue.shift();
    // console.log("skipCache", dc.skipCache);
    dc.ajax({action: "analyze-project", project_id: project_id, skip_cache: dc.skipCache}, dc.analyzeProjectResults);
};
dc.analyzeProjectResults = function(result) {
    // Add row to table
    dc.addRow(result);

    // Update progress
    dc.analysisIndex++;

    // do we need to update?
    let update_delay = 1;
    const now = +new Date();
    if ((now-dc.progressUpdate) > 1000) {
        // it has been a second since last update
        let percent = Math.round((((dc.analysisCount - dc.analysisQueue.length) / dc.analysisCount)) * 100);
        dc.updateProgressBar(percent, percent + "% (" + dc.analysisIndex + "/" + dc.analysisCount + ")");
        dc.progressUpdate = now;
        dc.updateSummary();
        update_delay = 10;
    }

    // Get next queue member
    setTimeout(dc.analyzeProject, update_delay);
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
 * @param row // {"project_id":x,"title":"foo","raw_data":[],"overlap":[],"duration":17.325,
 *            // "unique_records":44,"timestamp":"yyyy-mm-dd HH:ii:ss" (optional)}
 */
dc.addRow = function(row, skip_redraw) {
    // console.log(project);

    // Cache the project row
    let project_id = row.project_id;
    dc.projects[project_id] = row;

    // Build each column for the table
    const pk = "<a href='" + app_path_webroot + "?pid=" + project_id + "' " +
        "data-pidRow=" + project_id + " target='_BLANK'>" + project_id + "</a>";

    const title = row.title;

    const collisions       = row.hasOwnProperty('collisions')              ? row.collisions.length               : "-";
    const records          = row.hasOwnProperty('distinct_records')        ? row.distinct_records.length         : "-";
    const empty_records    = row.hasOwnProperty('empty_record_collisions') ? row.empty_record_collisions.length  : "-";
    const duration         = row.hasOwnProperty('duration')                ? row.duration                        : null;
    const timestamp        = row.hasOwnProperty('timestamp')               ? row.timestamp                       : "";

    // Turns out the page is a valuable piece of information
    let pages = [];
    const entries = Object.values(row.raw_data.results);
    for (const entry of entries) {
        console.log("Entry",entry);
        if (entry.hasOwnProperty('page')) pages.push(entry.page);
    }
    // Get unique pages
    const distinct = (value, index, self) => {
        return self.indexOf(value) === index;
    };
    const distinct_pages = pages.filter(distinct);

    // const overlap    = row.hasOwnProperty('overlap')   ? row.overlap        : null;
    // const raw_data   = row.hasOwnProperty('raw_data')  ? row.raw_data       : null

    let actions = "";

    // See if we have analyzed this row before
    if(duration === null) {
        actions = actions + "<button class='btn btn-xs btn-primary' data-action='analyze' " +
            "data-pid='" + project_id + "'>Analyze</button>";
    } else {
        actions = actions + "<button class='btn btn-xs btn-secondary' data-action='analyze' " +
            "data-skip-cache=1 data-pid='" + project_id + "'>Refresh</button>";
    }
    // Add a details button if there are collisions
    if(collisions > 0 || empty_records > 0) {
        actions = actions + "<br/><button class='mt-1 btn btn-xs btn-success text-nowrap' data-action='view-details' data-pid='" + project_id + "'>Toggle Details</button>";
    }

    // Remove the row if it already exists
    let existingRow = $("#projects-table tr").filter(function() {
        return $('td:first', this).text() == row.project_id;
    });
    if (existingRow.length) {
        // Subtract from totals
        console.log ("Removing row " + project_id);
        dc.dataTable.row(existingRow).remove();
    }

    // Build childrow:
    let child_json = $('<pre class="json-viewer"/>')
        .jsonViewer(row, {
            // collapsed:true
        });

    let child_row = child_json.wrap('<td class="child" colspan="' + dc.columns.length + '"/>').wrap("<tr/>");

    let r = dc.dataTable.row.add(
        [
            pk,
            title,
            collisions,
            records,
            // empty_records,
            // Replacing empty records with pages...
            distinct_pages.join('<br>'),
            duration,
            timestamp,
            actions
        ]
    )
    .child(
        child_row
    );

    if (! isNaN(collisions)) dc.collisionCount += collisions;
    if (! isNaN(records))    dc.recordCount    += records;

    console.log(row);
    if (! skip_redraw) dc.dataTable.draw();
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

dc.isParent = function(c) {
    return c.startsWith("<a");
};

dc.updateSummary = function() {
    let project_count = dc.dataTable.columns(0).data()[0].filter(dc.isParent).length; //('').split('').length;

    // Convert column to numerical sum
    let collisions  = dc.dataTable.columns(2).data()[0].reduce( function(a,b) {
        return ( isNaN(a) ? 0 : parseFloat(a) ) + ( isNaN(b) ? 0 : parseFloat(b) );
    });

    let records  = dc.dataTable.columns(3).data()[0].reduce( function(a,b) {
        return ( isNaN(a) ? 0 : parseFloat(a) ) + ( isNaN(b) ? 0 : parseFloat(b) );
    });

    let db_time  = dc.dataTable.columns(5).data()[0].reduce( function(a,b) {
        return ( isNaN(a) || a == null ? 0 : parseFloat(a) ) + ( isNaN(b) || b == null ? 0 : parseFloat(b) );
    });
    db_time = isNaN(db_time) || db_time == null ? 0 : db_time;

    let number_done = dc.dataTable.columns(5).data()[0].filter(function(x){ return x == x*1 }).length;

    $('div.table-summary').remove();
    let ts = $('<div class="table-summary"/>')
        .append("<span class='badge badge-danger'>" + dc.formatNumberWithCommas(collisions) + " Collisions</span>")
        .append("<span class='badge badge-info'>" + dc.formatNumberWithCommas(records) + " Affected Records</span>")
        .append("<span class='badge badge-secondary'>" + dc.formatNumberWithCommas(number_done) + " of " +
            dc.formatNumberWithCommas(project_count) + " (" + (number_done/project_count*100).toFixed(1) +
            "%) Projects Analyzed in " + dc.formatNumberWithCommas(+(db_time/60).toFixed(2)) + " minutes</span>")
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

