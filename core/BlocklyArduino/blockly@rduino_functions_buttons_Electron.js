/**
 * Blockly@rduino
 */

'use strict';


/**
 * Populate the edit textarea "edit_code" with the pre arduino code
 */
BlocklyDuino.editArduinoCode = function() {
    $('#edit_code').val($('#pre_arduino').text());
};

/**
 * Creates an XML file containing the blocks from the Blockly workspace and
 * prompts the users to save it into their local file system.
 */
BlocklyDuino.saveXmlFile = function() {
    var xml = Blockly.Xml.workspaceToDom(Blockly.mainWorkspace);

    var toolbox = sessionStorage.getItem('toolbox');
    if (!toolbox) {
        toolbox = $("#toolboxes").val();
    }

    if (toolbox) {
        var newel = document.createElement("toolbox");
        newel.appendChild(document.createTextNode(toolbox));
        xml.insertBefore(newel, xml.childNodes[0]);
    }

    var toolboxids = sessionStorage.getItem('toolboxids');
    if (toolboxids === undefined || toolboxids === "") {
        if ($('#defaultCategories').length) {
            toolboxids = $('#defaultCategories').html();
        }
    }

    if (toolboxids) {
        var newel = document.createElement("toolboxcategories");
        newel.appendChild(document.createTextNode(toolboxids));
        xml.insertBefore(newel, xml.childNodes[0]);
    }

    var data = Blockly.Xml.domToPrettyText(xml);
    var datenow = Date.now();
    var uri = 'data:text/xml;charset=utf-8,' + encodeURIComponent(data);
    $(this).attr({
        'download': "blockly_arduino" + datenow + ".B@",
        'href': uri,
        'target': '_blank'
    });
};

/**
 * Creates an INO file containing the Arduino code from the Blockly workspace and
 * prompts the users to save it into their local file system.
 */
BlocklyDuino.saveArduinoFile = function() {
    var code = $('#pre_arduino').text();
    var datenow = Date.now();
    var filename = "arduino_" + datenow + ".ino";
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/ino;charset=utf-8,' + encodeURIComponent(code));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
};

/**
 * Load Arduino code from component pre_arduino
 */
BlocklyDuino.getFiles = function() {
    var code = $('#pre_arduino').text();
    return { "sketch.ino": code.replace(/</g, '&lt;').replace(/>/g, '&gt;') };
};


/**
 // * Load blocks from local file.
 */
BlocklyDuino.load = function(event) {
    var files = event.target.files;
    // Only allow uploading one file.
    if (files.length != 1) {
        return;
    }
    // FileReader
    var reader = new FileReader();
    reader.onloadend = function(event) {
        var target = event.target;
        // 2 == FileReader.DONE
        if (target.readyState == 2) {
            try {
                var xml = Blockly.Xml.textToDom(target.result);
            } catch (e) {
                alert(MSG['xmlError'] + '\n' + e);
                return;
            }
            var count = BlocklyDuino.workspace.getAllBlocks().length;
            if (count && confirm(MSG['xmlLoad'])) {
                BlocklyDuino.workspace.clear();
            }
            $('#tab_blocks a').tab('show');
            Blockly.Xml.domToWorkspace(xml, BlocklyDuino.workspace);
            BlocklyDuino.selectedTab = 'blocks';
            BlocklyDuino.renderContent();

            // load toolbox
            var elem = xml.getElementsByTagName("toolbox")[0];
            if (elem != undefined) {
                var node = elem.childNodes[0];
                sessionStorage.setItem('toolbox', node.nodeValue);
                $("#toolboxes").val(node.nodeValue);

                // load toolbox categories
                elem = xml.getElementsByTagName("toolboxcategories")[0];
                if (elem != undefined) {
                    node = elem.childNodes[0];
                    sessionStorage.setItem('toolbox', node.nodeValue);
                }

                var search = BlocklyDuino.addReplaceParamToUrl(window.location.search, 'toolbox', $("#toolboxes").val());
                search = search.replace(/([?&]url=)[^&]*/, '');
                window.location = window.location.protocol + '//' +
                    window.location.host + window.location.pathname +
                    search;
            }
        }
        // Reset value of input after loading because Chrome will not fire
        // a 'change' event if the same file is loaded again.
        $('#load').val('');
    };
    reader.readAsText(files[0]);
};

/**
 * Discard all blocks from the workspace.
 */
BlocklyDuino.discard = function() {
    var count = BlocklyDuino.workspace.getAllBlocks().length;
    if (count < 2 || window.confirm(MSG['discard'].replace('%1', count))) {
        BlocklyDuino.workspace.clear();
        //clean URL from example if opened
        var search = window.location.search;
        var newsearch = search.replace(/([?&]url=)[^&]*/, '');
        window.history.pushState(search, "Title", newsearch);
        BlocklyDuino.renderContent();
    }
};

/**
 * Undo/redo functions
 */
BlocklyDuino.Undo = function() {
    Blockly.mainWorkspace.undo(0);
};
BlocklyDuino.Redo = function() {
    Blockly.mainWorkspace.undo(1);
};


/**
 * Reset Blockly@rduino and clean webbrowser cache, local storage
 */
BlocklyDuino.clearLocalStorage = function() {
    window.removeEventListener('unload', BlocklyDuino.backupBlocks, false);
    localStorage.clear();
    sessionStorage.clear();
};


/**
 * Change ergonomy and resize left buttons in just icons
 */
BlocklyDuino.miniMenuPanel = function() {
    // Store the blocks for the duration of the reload.
    BlocklyDuino.backupBlocks();

    var search = window.location.search;
    if (search.length <= 1) {
        search = '?size=miniMenu';
    } else if (search.match(/[?&]size=[^&]*/)) {
        search = search.replace(/([?&]size=)[^&]*/, '');
        search = search.replace(/\&/, '?');
    } else {
        search = search.replace(/\?/, '?size=miniMenu&');
    }

    // remove url file
    //search = search.replace(/([?&]url=)[^&]*/, '');
    window.location = window.location.protocol + '//' + window.location.host + window.location.pathname + search;
};


/**
 * Try to take a screen capture of all blocks on workspace
 * Thanks to fontaine.jp from forum http://blockly.technologiescollege.fr/forum/index.php/topic,128.msg635.html#new
 *
 */
BlocklyDuino.workspace_capture = function() {
    var ws = BlocklyDuino.workspace.svgBlockCanvas_.cloneNode(true);
    ws.removeAttribute("width");
    ws.removeAttribute("height");
    ws.removeAttribute("transform");
    var styleElem = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleElem.textContent = Blockly.Css.CONTENT.join('');
    ws.insertBefore(styleElem, ws.firstChild);
    var bbox = BlocklyDuino.workspace.svgBlockCanvas_.getBBox();
    var canvas = document.createElement("canvas");
    canvas.width = Math.ceil(bbox.width + 10);
    canvas.height = Math.ceil(bbox.height + 10);
    var ctx = canvas.getContext("2d");
    var xml = new XMLSerializer().serializeToString(ws);
    xml = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + bbox.width + '" height="' + bbox.height + '" viewBox="' + bbox.x + ' ' + bbox.y + ' ' + bbox.width + ' ' + bbox.height + '"><rect width="100%" height="100%" fill="white"></rect>' + xml + '</svg>';
    var img = new Image();
    img.setAttribute("src", 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml))));
    img.onload = function() {
        ctx.drawImage(img, 5, 5);
        var canvasdata = canvas.toDataURL("image/png", 1);
        var datenow = Date.now();
        var a = document.createElement("a");
        a.download = "capture" + datenow + ".png";
        a.href = canvasdata;
        document.body.appendChild(a);
        a.click();
    }
};

// Compile (verify) button handler
BlocklyDuino.verify_local_Click = function() {
    console.log("Verify button clicked");
    if (typeof profile === 'undefined' || !profile.defaultBoard || !profile.defaultBoard['upload_arg']) {
        alert("Board profile is not defined. Please select a board.");
        return;
    }
    var board = "board=" + profile.defaultBoard['upload_arg'];
    var url = "http://127.0.0.1:5005/set_board";
    var method = "POST";
    var async = true;
    var request = new XMLHttpRequest();
    request.open(method, url, async);
    request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    request.onreadystatechange = function() {
        if (request.readyState == 4 && request.status == 200) {
            alert(request.responseText);
        }
    }
    request.send(board);
    setTimeout(function() {
        var code = $('#pre_arduino').text();
        url = "http://127.0.0.1:5005/compile";
        request.open(method, url, async);
        request.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
        request.onreadystatechange = function() {
            if (request.readyState == 4) {
                alert(request.responseText);
            }
        }
        request.send(code);
    }, 1000);
};

// Upload button handler
BlocklyDuino.uploadClick = function() {
    // Get the code, board, and port
    var code = $('#pre_arduino').text();
    var port = document.getElementById('serialport_ide').value;
    var board = (typeof profile !== 'undefined' && profile.defaultBoard && profile.defaultBoard['upload_arg'])
        ? profile.defaultBoard['upload_arg']
        : 'arduino_uno'; // fallback

    // Edge case: No code
    if (!code || code.trim() === "") {
        alert("No code to upload. Please generate code first.");
        return;
    }
    // Edge case: No port
    if (!port || port === 'no_com') {
        alert("No serial port selected. Please connect your board and select a port.");
        return;
    }
    // Edge case: No board
    if (!board) {
        alert("No board selected. Please select a board in the configuration.");
        return;
    }

    fetch('http://127.0.0.1:5005/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: code,
            board: board,
            port: port
        })
    })
    .then(response => response.json())
    .then(resp => {
        if (resp.success || resp.message === 'Upload successful') {
            alert("Upload successful!\n" + (resp.message || ''));
        } else {
            alert("Upload failed!\n" + (resp.message || resp.error));
        }
    })
    .catch(err => {
        alert("Network error or backend not reachable.\n" + err);
    });
};

// Bind the handlers to the buttons
$(document).ready(function() {
    $('#btn_verify_local').on('click', BlocklyDuino.verify_local_Click);
    $('#btn_flash_local').on('click', BlocklyDuino.uploadClick);
});