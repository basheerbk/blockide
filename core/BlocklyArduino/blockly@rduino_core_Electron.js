/**
 * Blockly@rduino
 */

'use strict';

goog.require('Blockly.Blocks');
goog.require('Blockly.Types');
goog.require('Blockly.FieldDate');

/**
 * Create a namespace for the application.
 */
var BlocklyDuino = {};
Blockly.pathToBlockly = './';
Blockly.pathToMedia = './media/';

BlocklyDuino.selectedToolbox = "toolbox_none";
BlocklyDuino.selectedCard = 'none';
BlocklyDuino.selectedTab = 'blocks';
BlocklyDuino.inlineBool = true;
BlocklyDuino.withImage = true;
BlocklyDuino.ajaxOK = true;
BlocklyDuino.toolboxInIndexHtml = false;
BlocklyDuino.loadingDefaultBlocks = false;

/**
 * Blockly's main workspace.
 * @type {Blockly.WorkspaceSvg}
 */
BlocklyDuino.workspace = null;
var BlocklyLevel = 'none';

/**
 * Custom workspaceToCode function that processes all top-level blocks, including those not connected to Arduino structure blocks.
 * @param {Blockly.Workspace} workspace The workspace to generate code from.
 * @return {string} Generated Arduino code.
 */
BlocklyDuino.workspaceToCode = function(workspace) {
    if (!workspace) {
        console.warn("No workspace specified in workspaceToCode call. Guessing.");
        workspace = Blockly.getMainWorkspace();
    }
    
    var code = [];
    Blockly.Arduino.init(workspace);
    
    // Get all top-level blocks
    var topBlocks = workspace.getTopBlocks(true);

    // Helper: is this block a function definition?
    function isFunctionDefinition(block) {
        return block.type === 'procedures_defnoreturn' || block.type === 'procedures_defreturn';
    }

    // Helper: is this block connected to a root (setup/loop)?
    function isConnectedToRoot(block) {
        // Traverse upwards to see if this block is ultimately connected to a root
        var current = block;
        while (current) {
            if (
                current.type === 'base_setup_loop' ||
                current.type === 'base_setup' ||
                current.type === 'base_loop' ||
                current.type === 'base_begin' ||
                current.type === 'base_end' // add more root types if needed
            ) {
                return true;
            }
            current = current.getParent && current.getParent();
        }
        return false;
    }

    for (var i = 0; i < topBlocks.length; i++) {
        var block = topBlocks[i];
        if (isFunctionDefinition(block) || isConnectedToRoot(block)) {
            var blockCode = Blockly.Arduino.blockToCode(block);
            if (goog.isArray(blockCode)) {
                blockCode = blockCode[0];
            }
            if (blockCode) {
                if (block.outputConnection && Blockly.Arduino.scrubNakedValue) {
                    blockCode = Blockly.Arduino.scrubNakedValue(blockCode);
                }
                code.push(blockCode);
            }
        }
        // else: orphaned, skip
    }
    
    var result = code.join('\n');
    result = Blockly.Arduino.finish(result);
    result = result.replace(/^\s+\n/, '');
    result = result.replace(/\n\s+$/, '\n');
    return result;
};

/**
 * Helper function to get all blocks connected to a given block (recursively).
 * @param {Blockly.Block} startBlock The starting block.
 * @return {Array<Blockly.Block>} Array of all connected blocks.
 */
BlocklyDuino.getAllConnectedBlocks = function(startBlock) {
    var connectedBlocks = [];
    var visited = new Set();
    
    function traverseBlock(block) {
        if (!block || visited.has(block.id)) {
            return;
        }
        
        visited.add(block.id);
        connectedBlocks.push(block);
        
        // Check all inputs
        for (var i = 0; i < block.inputList.length; i++) {
            var input = block.inputList[i];
            if (input.connection && input.connection.targetBlock()) {
                traverseBlock(input.connection.targetBlock());
            }
        }
        
        // Check next statement
        if (block.nextConnection && block.nextConnection.targetBlock()) {
            traverseBlock(block.nextConnection.targetBlock());
        }
        
        // Check previous statement
        if (block.previousConnection && block.previousConnection.targetBlock()) {
            traverseBlock(block.previousConnection.targetBlock());
        }
    }
    
    traverseBlock(startBlock);
    return connectedBlocks;
};

/**
 * Populate the currently selected pane with content generated from the blocks.
 */
BlocklyDuino.renderContent = function() {
    var content = $('#content_' + BlocklyDuino.selectedTab);
    if (content.prop('id') == 'content_blocks') {
        // If the workspace was changed by the XML tab, Firefox will have
        // performed an incomplete rendering due to Blockly being invisible. Rerender.
        BlocklyDuino.workspace.render();
        $(".blocklyTreeSeparator").removeAttr("style");
        $(".blocklyToolboxDiv").show();
        $("#tools_blocks").show();
        $("#btn_levels").show();
        $("#header_supervision").hide();
        $("#header_code").hide();
    } else {
        switch (content.prop('id')) {
            // case 'content_xml':
            // $(".blocklyToolboxDiv").hide();
            // $('#pre_xml').text(Blockly.Xml.domToPrettyText(Blockly.Xml.workspaceToDom(BlocklyDuino.workspace)));
            // if (typeof prettyPrintOne == 'function') {
            // $('#pre_xml').html(prettyPrintOne($('#pre_xml').html(), 'xml'));
            // }
            // $("#tools_blocks").hide();
            // break;

            case 'content_arduino':
                $(".blocklyToolboxDiv").hide();
                try {
                    var cardId = BlocklyDuino.getStringParamFromUrl('card', '');
                    if (cardId != 'kit_microbit') $('#pre_Arduino').text(BlocklyDuino.workspaceToCode(BlocklyDuino.workspace));
                    else $('#pre_Arduino').text(Blockly.Python.workspaceToCode(BlocklyDuino.workspace));
                    if (typeof prettyPrintOne == 'function') {
                        $('#pre_arduino').html(prettyPrintOne($('#pre_arduino').html(), 'cpp'));
                    }
                    BlocklyDuino.toggleFunctionsChoice();
                } catch (e) {
                    alert(e);
                }
                $("#tools_blocks").hide();
                $("#btn_levels").hide();
                $("#header_supervision").hide();
                $("#header_code").show();
                break;

                //case 'content_supervision':
                //$("#content_supervision").load('./tools/supervision/pymata_arduino.html', BlocklyDuino.renderSupervisionContent);
                //$("#tools_blocks").hide();
                //$("#btn_levels").hide();
                //$("#header_supervision").show();
                //$("#header_code").hide();
        }
    }
};

/**
 * Render block factory
 */
BlocklyDuino.renderArduinoCodePreview = function() {
    var cardId = BlocklyDuino.getStringParamFromUrl('card', '');
    if (cardId != 'kit_microbit') {
        $('#pre_previewArduino').text(BlocklyDuino.workspaceToCode(BlocklyDuino.workspace));
        $('#pre_arduino').text(BlocklyDuino.workspaceToCode(BlocklyDuino.workspace));
    } else {
        $('#pre_previewArduino').text(Blockly.Python.workspaceToCode(BlocklyDuino.workspace));
        $('#pre_arduino').text(Blockly.Python.workspaceToCode(BlocklyDuino.workspace));
    }
    if (typeof prettyPrintOne == 'function') {
        $('#pre_previewArduino').html(prettyPrintOne($('#pre_previewArduino').html(), 'cpp'));
        $('#pre_arduino').html(prettyPrintOne($('#pre_previewArduino').html(), 'cpp'));
    }
    
    // Also update modal content if modal is open
    if ($('#sideExpandModal').hasClass('in')) {
        var modalOutput = document.getElementById('sideExpandOutput');
        if (modalOutput) {
            modalOutput.textContent = $('#pre_previewArduino').text();
            if (typeof prettyPrintOne == 'function') {
                modalOutput.innerHTML = prettyPrintOne(modalOutput.textContent, 'cpp');
            }
        }
    }
};

/**
 * Populate the supervision tabs with selected card
 */
BlocklyDuino.renderSupervisionContent = function() {
    // tabs-1
    var pinTemplate1 = $("#template_tabs1").html();
    var digitalNumbers = window.profile["defaultBoard"].digital;
    for (var i in digitalNumbers) {
        var pinLine = pinTemplate1.replace(/#pin_number#/g, digitalNumbers[i]);
        $("#tabs-1").append(pinLine);
    }

    // tabs-2
    var pinTemplate2 = $("#template_tabs2").html();
    var pwmTemplate = $("#template_tabs2_pwm").html();
    var pwmNumbers = window.profile["defaultBoard"].PWM;
    for (var i in digitalNumbers) {
        var pinLine = pinTemplate2;
        if ($.inArray(digitalNumbers[i], pwmNumbers) != -1) {
            pinLine = pinLine.replace("#pwm_line#", pwmTemplate);
        } else {
            pinLine = pinLine.replace("#pwm_line#", "");
        }
        pinLine = pinLine.replace(/#pin_number#/g, digitalNumbers[i]);
        $("#tabs-2").append(pinLine);
    }

    // tabs-3
    var pinTemplate3 = $("#template_tabs3").html();
    var analogNumbers3 = window.profile["defaultBoard"].analog;
    for (var i in analogNumbers3) {
        var pinNumber = analogNumbers3[i].substring(1);
        var pinLine = pinTemplate3.replace(/#pin_number#/g, pinNumber);
        $("#tabs-3").append(pinLine);
    }

    // tabs-4
    var pinTemplate4 = $("#template_tabs4").html();
    var analogNumbers4 = window.profile["defaultBoard"].analog;
    for (var i in analogNumbers4) {
        var pinNumber = analogNumbers4[i].substring(1);
        var pinLine = pinTemplate4.replace(/#pin_number#/g, pinNumber);
        $("#tabs-4").append(pinLine);
    }

    Code.initLanguageSupervision();
    jscolor.installByClassName("jscolor");
    $.getScript("./tools/supervision/s2aio_iot.js");
};

/**
 * Populate the content arduino code pane with the edit textarea "edit_code"
 */
BlocklyDuino.valideEditedCode = function() {
    try {
        $('#pre_arduino').text($('#edit_code').val());
        if (typeof prettyPrintOne == 'function') {
            $('#pre_arduino').html(prettyPrintOne($('#pre_arduino').html(), 'cpp'));
        }
    } catch (e) {
        alert(e);
    }
};

/**
 * Get parameters from URL.
 * @param {string} name Parameter name.
 * @param {string} defaultValue Value of parameter if not present.
 * @return {string} The parameter value or the default value if not found.
 */
BlocklyDuino.getStringParamFromUrl = function(name, defaultValue) {
    var val = location.search.match(new RegExp('[?&]' + name + '=([^&]+)'));
    return val ? decodeURIComponent(val[1].replace(/\+/g, '%20')) : defaultValue;
};

/**
 * Get the size of the window.
 * @return {string} The size parameter from URL or 'max' by default.
 */
BlocklyDuino.getSize = function() {
    return BlocklyDuino.getStringParamFromUrl('size', 'max');
};

/**
 * Add or replace a parameter to the URL.
 * 
 * @param {string} name The name of the parameter.
 * @param {string} value Value to set
 * @return {string} The url completed with parameter and value
 */
BlocklyDuino.addReplaceParamToUrl = function(url, param, value) {
    var re = new RegExp("([?&])" + param + "=.*?(&|$)", "i");
    var separator = url.indexOf('?') !== -1 ? "&" : "?";
    if (url.match(re)) {
        return url.replace(re, '$1' + param + "=" + value + '$2');
    } else {
        return url + separator + param + "=" + value;
    }
};

/**
 * Load blocks saved on App Engine Storage or in session/local storage.
 * This function is now responsible for deciding if the default blocks should be
 * loaded.
 * @param {string}
 *            defaultXml Text representation of default blocks from a file.
 */
BlocklyDuino.loadBlocks = function(defaultXml) {
    var blocksLoadedFromFile = false;
    if (defaultXml) {
        // Load the editor with default starting blocks from a file.
        var xml = Blockly.Xml.textToDom(defaultXml);
        if (xml.getElementsByTagName('block').length > 0) {
            Blockly.Xml.domToWorkspace(xml, BlocklyDuino.workspace);
            blocksLoadedFromFile = true;
        }
    }

    if (blocksLoadedFromFile) {
        // Blocks were loaded from a file, so we are done.
        return;
    }

    // No blocks from file, so check session storage.
    var blocksLoadedFromSession = false;
    var loadOnce = null;
    try {
        loadOnce = sessionStorage.getItem('loadOnceBlocks');
    } catch (e) {
        // Firefox sometimes throws a SecurityError when accessing localStorage.
    }

    if (loadOnce && loadOnce.indexOf('<block') > -1) {
        // Session storage has blocks, so load them.
        var xml = Blockly.Xml.textToDom(loadOnce);
        Blockly.Xml.domToWorkspace(xml, BlocklyDuino.workspace);
        blocksLoadedFromSession = true;
    }

    // If no blocks were loaded from a file or a populated session,
    // load the default Arduino block.
    if (!blocksLoadedFromFile && !blocksLoadedFromSession) {
        BlocklyDuino.loadDefaultArduinoBlocks();
    }
};

/**
 * Sets Arduino card
 */
BlocklyDuino.setArduinoBoard = function() {
    var cardId = BlocklyDuino.getStringParamFromUrl('card', '');
    if (!cardId) {
        cardId = BlocklyDuino.selectedCard;
    }
    $("#board_select").val(cardId);

    // set the card from url parameters
    profile["defaultBoard"] = profile[cardId];
    $('#arduino_card_picture').attr("src", profile.defaultBoard['picture']);
    $('#arduino_card_miniPicture').attr("src", profile.defaultBoard['miniPicture']);
    $('#arduino_card_miniPicture_Menu').attr("src", profile.defaultBoard['miniPicture_hor']);
    $('#pictureModalLabel').attr('title', (profile.defaultBoard['description']));
    if ($("#board_select").val().substring(0, 4) == "kit_") {
        $("#btn_config").remove();
        $("#btn_config_kit").removeClass('hidden');
        $('#btn_config_kit').attr("href", profile[$("#board_select").val()]['help_link']);
    }
    BlocklyDuino.cardPicture_change_AIO();
};


/**
 * Binds functions to each of the buttons, nav links, and related.
 */
BlocklyDuino.bindFunctions = function() {

    $('#clearLink', '#btn_reset').on("click", BlocklyDuino.clearLocalStorage);

    var clipboard = new Clipboard('#btn_CopyCode');

    // Navigation buttons
    $('#btn_delete').on("click", BlocklyDuino.discard);
    $('#btn_undo').on("click", BlocklyDuino.Undo);
    $('#btn_redo').on("click", BlocklyDuino.Redo);
    $('#btn_pasteIDEArduino').remove();
    $('#btn_saveArduino').on("click", BlocklyDuino.saveArduinoFile);
    $('#btn_block_capture').on("click", BlocklyDuino.workspace_capture);
    $('#btn_saveXML, #menu_12').on("click", BlocklyDuino.saveXmlFile);
    $('#btn_validCode').on("click", BlocklyDuino.valideEditedCode);
    $('#btn_factory').on("click", function() {
        var langChoice = BlocklyDuino.getStringParamFromUrl('lang', '');
        window.open("./tools/factory/block_factory.html?lang=" + langChoice, "_blank");
    });
    $('#load').on("change", BlocklyDuino.load);
    $('#btn_fakeload, #menu_11').on("click", function() {
        $('#load').click();
    });
    $('#btn_preview').on("click", function() {
        $("#toggle_code").toggle("blind");
    });
    $('#pre_previewArduino').on("click", function() {
        $("#toggle_code").toggle("blind");
    });

    $('#toggle-Colors').on("change", BlocklyDuino.toggleTextColors);

    $('#board_select').on("focus", function() {
        BlocklyDuino.selectedCard = $(this).val();
    });
    $('#btn_edit_code').mouseover(function() {
        document.getElementById("survol").textContent = MSG['span_edit_code'];
    }).mouseout(function() {
        document.getElementById("survol").textContent = "";
    });
    $('#btn_saveArduino').mouseover(function() {
        document.getElementById("survol").textContent = MSG['span_saveIno'];
    }).mouseout(function() {
        document.getElementById("survol").textContent = "";
    });
    $('#btn_verify_local').mouseover(function() {
        document.getElementById("survol").textContent = MSG['span_verify_local'];
    }).mouseout(function() {
        document.getElementById("survol").textContent = "";
    });
    $('#btn_flash_local').mouseover(function() {
        document.getElementById("survol").textContent = MSG['span_flash_local'];
    }).mouseout(function() {
        document.getElementById("survol").textContent = "";
    });
    $('#btn_term').mouseover(function() {
        document.getElementById("survol").textContent = MSG['span_connect_serial'];
    }).mouseout(function() {
        document.getElementById("survol").textContent = "";
    });
    $('#btn_configGlobal').on("click", BlocklyDuino.buildlibraries);
    $('#configModalGlobal').on("hidden.bs.modal", function() {
        $("#board_select").val(BlocklyDuino.selectedCard);
        BlocklyDuino.cardPicture_change_AIO();
    });

    $('#toolboxes').on("focus", function() {
        BlocklyDuino.selectedToolbox = $(this).val();
    });

    //menu déroulant
    $('#toolboxes, #toggle-Functions').on("change", BlocklyDuino.changeToolboxDefinition);
    // $('#toolboxes').on("change", BlocklyDuino.changeToolboxDefinition);

    //bouton de niveaux
    $('#toolbox_algo, #menu_420').on("click", function(e) {
        e.preventDefault();
        document.getElementById("toolboxes").options.selectedIndex = 1;
        BlocklyDuino.changeToolboxDefinition();
    });

    $('#toolbox_arduino_1, #menu_421').on("click", function(e) {
        e.preventDefault();
        document.getElementById("toolboxes").options.selectedIndex = 2;
        BlocklyDuino.changeToolboxDefinition();
    });

    $('#toolbox_arduino_2, #menu_422').on("click", function(e) {
        e.preventDefault();
        document.getElementById("toolboxes").options.selectedIndex = 3;
        BlocklyDuino.changeToolboxDefinition();
    });

    $('#toolbox_arduino_3, #menu_423').on("click", function(e) {
        e.preventDefault();
        document.getElementById("toolboxes").options.selectedIndex = 4;
        BlocklyDuino.changeToolboxDefinition();
    });

    $('#toolbox_arduino_4, #menu_424').on("click", function(e) {
        e.preventDefault();
        document.getElementById("toolboxes").options.selectedIndex = 5;
        BlocklyDuino.changeToolboxDefinition();
    });

    $('#toolbox_arduino_all, #menu_429').on("click", function(e) {
        e.preventDefault();
        document.getElementById("toolboxes").options.selectedIndex = 6;
        BlocklyDuino.changeToolboxDefinition();
    });

    $('#menuPanelBlockly li[id^=tab_]').on("click", function() {
        BlocklyDuino.selectedTab = $(this).attr('id').substring(4);
        BlocklyDuino.renderContent();
    });

    $('#divTitreMenu_menu li[id^=mtab_]').on("click", function() {
        BlocklyDuino.selectedTab = $(this).attr('id').substring(5);
        BlocklyDuino.renderContent();
    });

    $('#btn_miniMenuPanel, #menu_441').on("click", BlocklyDuino.miniMenuPanel);

    $('#btn_size').on("click", BlocklyDuino.changeSize);
    $('#btn_config').on("click", BlocklyDuino.openConfigToolbox);

    $('#btn_edit_code').on("click", BlocklyDuino.editArduinoCode);

    $('#select_all').on("click", BlocklyDuino.checkAll);
    $('#btn_valid_config').on("click", BlocklyDuino.changeToolbox);
    $('#btn_validConfigGlobale').on("click", BlocklyDuino.validateConfigGlobal);
    $('#btn_card_picture_change').on("click", BlocklyDuino.validateConfigOffline);
    $('#textSize').on("click", BlocklyDuino.tailleFonte);

    $('#btn_valid_msg').on("click", function() {
        if ($('#ajax_msg').prop("checked")) {
            sessionStorage.setItem('msg_ajax_seen', true);
        }
        $('#ajaxModal').modal('hide');
    });

    $('#btn_inline').on("click", BlocklyDuino.inline);
    //$('#btn_wiring').on("click", BlocklyDuino.openWiringDialog);
    $('#btn_blocs_picture_mini').on("click", BlocklyDuino.blockPicture_mini);
    $('#btn_blocs_picture_maxi').on("click", BlocklyDuino.blockPicture_maxi);
    $('#btn_blocs_picture').on("click", BlocklyDuino.blockPicture);

    $('#btn_card_picture_mini').on("click", BlocklyDuino.cardPicture_mini);
    $('#btn_card_picture_maxi').on("click", BlocklyDuino.cardPicture_maxi);
    $('#btn_wiring_mini').on("click", BlocklyDuino.wiring_mini);
    $('#btn_wiring_maxi').on("click", BlocklyDuino.wiring_maxi);

    $('#btn_example, #menu_131').on("click", BlocklyDuino.buildExamples);

    $('#miniCard, #miniCard_Menu').on('click', function() {
        var dialogConvert = $("#pictureModalLabel").dialog({
            autoOpen: false,
            resizable: false,
            height: $("#arduino_card_picture").offsetHeight,
            width: $("#arduino_card_picture").offsetWidth,
            show: {
                effect: "drop",
                duration: 600
            },
            hide: {
                effect: "drop",
                duration: 600
            },
            position: {
                my: "center",
                at: "center",
                of: window
            },
        });
        if (!dialogConvert.dialog("isOpen")) {
            dialogConvert.dialog("open").dialog("option", "buttons");
        };
    });

    $('#btn_wiring, #menu_21').on('click', function() {
        var dialogConvert = $("#wiringModal").dialog({
            autoOpen: false,
            resizable: true,
            height: 400,
            width: 600,
            show: {
                effect: "drop",
                duration: 600
            },
            hide: {
                effect: "drop",
                duration: 600
            },
            position: {
                my: "center",
                at: "center",
                of: window
            },
        });
        if (!dialogConvert.dialog("isOpen")) {
            dialogConvert.dialog("open").dialog("option", "buttons");
        };
    });

    $('#btn_convert, #menu_31').on('click', function() {
        var dialogConvert = $("#convertModal").dialog({
            autoOpen: false,
            resizable: false,
            height: 200,
            width: 480,
            show: {
                effect: "drop",
                duration: 600
            },
            hide: {
                effect: "drop",
                duration: 600
            },
            position: {
                my: "center",
                at: "center",
                of: window
            },
        });
        if (!dialogConvert.dialog("isOpen")) {
            dialogConvert.dialog("open").dialog("option", "buttons");
        };
    });

    $('#btn_screenduino, #menu_32').on('click', function() {
        var iframe = $("#screen_falsemodal > iframe");
        var $screenlang = "./tools/screenduino/index.html";
        var dialogScreen = $("#screen_falsemodal").dialog({
            autoOpen: false,
            resizable: true,
            height: 600,
            width: 650,
            show: {
                effect: "drop",
                duration: 600
            },
            hide: {
                effect: "drop",
                duration: 600
            },
            position: {
                my: "center",
                at: "center",
                of: window
            },
        });
        iframe.attr({
            width: "100%",
            height: "100%",
            src: $screenlang
        });
        if (!dialogScreen.dialog("isOpen")) {
            dialogScreen.dialog("open").dialog("option", "buttons");
        };
    });
    $('#btn_RGB, #menu_33').on('click', function() {
        var iframe = $("#RGB_falsemodal > iframe");
        var $RGBlang = "./tools/RGB/RGB_" + Code.LANG + ".html";
        var dialogRGB = $("#RGB_falsemodal").dialog({
            autoOpen: false,
            resizable: true,
            height: 760,
            width: 550,
            show: {
                effect: "drop",
                duration: 600
            },
            hide: {
                effect: "drop",
                duration: 600
            },
            position: {
                my: "center",
                at: "center",
                of: window
            },
        });
        iframe.attr({
            width: "100%",
            height: "100%",
            src: $RGBlang
        });
        if (!dialogRGB.dialog("isOpen")) {
            dialogRGB.dialog("open").dialog("option", "buttons");
        };
    });
    //mini menus version
    $('#menu_24').on('click', function() {
        $("#barre_ide").prependTo("#content_arduino");
        $("#barre_supervision").prependTo("#content_supervision");
    });
};

/**
 * checks all checkboxes in modal "configModal"
 */
BlocklyDuino.checkAll = function() {
    if (this.checked) {
        // Iterate each checkbox
        $('#modal-body-config input:checkbox[id^=checkbox_]').each(function() {
            this.checked = true;
        });
    } else {
        $('#modal-body-config input:checkbox[id^=checkbox_]').each(function() {
            this.checked = false;
        });
    }
};

/**
 * Build modal to configure ToolBox
 */
BlocklyDuino.openConfigToolbox = function() {

    var modalbody = $("#modal-body-config");

    // load the toolboxes id's stored in session
    var loadIds = sessionStorage.getItem('toolboxids');

    // set the default toolbox if none
    if (loadIds === undefined || loadIds === "") {
        if ($('#defaultCategories').length) {
            loadIds = $('#defaultCategories').html();
        } else {
            loadIds = '';
        }
    }

    if (!BlocklyDuino.ajaxOK || BlocklyDuino.toolboxInIndexHtml) {
        $('#divToolbox').hide();
    }

    // clear modal
    modalbody.empty();
    var i = 0,
        n;
    var ligne = "";
    // create a checkbox for each toolbox category
    $("#toolbox").children("category").each(function() {
        n = loadIds.search($(this).attr("id"));
        // checks if toolbox was already chosen
        if (n >= 0) {
            ligne = '<input type="checkbox" checked="checked" name="checkbox_' +
                i + '" id="checkbox_' + $(this).attr("id") + '"/> ' +
                Blockly.Msg[$(this).attr("id")] + '<br/>';
        } else {
            ligne = '<input type="checkbox" name="checkbox_' + i +
                '" id="checkbox_' + $(this).attr("id") + '"/> ' +
                Blockly.Msg[$(this).attr("id")] + '<br/>';
        }
        i++;
        modalbody.append(ligne);
    });
};

/**
 * Change the ToolBox following the chosen configuration in the modal
 */
BlocklyDuino.changeToolbox = function() {
    // Store the blocks for the duration of the reload.
    BlocklyDuino.backupBlocks();

    // read the toolboxes id's from the checkboxes
    var toolboxIds = [];
    $('#modal-body-config input:checkbox[id^=checkbox_]').each(function() {
        if (this.checked == true) {
            var xmlid = this.id;
            toolboxIds.push(xmlid.replace("checkbox_", ""));
        }
    });

    // store id's in session
    sessionStorage.setItem('toolboxids', toolboxIds);

    var search = window.location.search;
    // put id's in url
    search = BlocklyDuino.addReplaceParamToUrl(search, 'toolboxids', toolboxIds);

    // store toolboxe id in session
    sessionStorage.setItem('toolbox', $("#toolboxes").val());

    search = BlocklyDuino.addReplaceParamToUrl(search, 'toolbox', $("#toolboxes").val());

    BlocklyDuino.toggleFunctionsChoice();

    // remove values from url to test toggles
    search = search.replace(/([?&]sortby=)[^&]*/, '');
    // put values in url
    if (search.length <= 1) {
        search = '?sortby=' + sessionStorage.getItem('catblocsort');
    } else {
        search = search + '&sortby=' + sessionStorage.getItem('catblocsort');
    }

    window.location = window.location.protocol + '//' + window.location.host + window.location.pathname + search;
};

/**
 * Build the xml using toolboxes checked in config modal and stored in session
 */
BlocklyDuino.buildToolbox = function() {
    // set the toolbox from url parameters
    var loadIds = BlocklyDuino.getStringParamFromUrl('toolboxids', '');
    var kitURL = BlocklyDuino.getStringParamFromUrl('card', '');

    // set the toolbox from local storage
    if (loadIds === undefined || loadIds === "") {
        loadIds = sessionStorage.getItem('toolboxids');
    }

    // set the default toolbox if none
    if (loadIds === undefined || loadIds === "" || loadIds === null || kitURL.startsWith('kit')) {
        if ($('#defaultCategories').length) {
            loadIds = $('#defaultCategories').html();
        } else {
            loadIds = '';
        }
    }

    sessionStorage.setItem('toolboxids', loadIds);

    var xmlValue = '<xml id="toolbox">';
    var xmlids = loadIds.split(",");
    for (var i = 0; i < xmlids.length; i++) {
        if ($('#' + xmlids[i]).length) {
            xmlValue += $('#' + xmlids[i])[0].outerHTML;
        }
    }

    xmlValue += '</xml>';

    return xmlValue;
};

/**
 * load the xml toolbox definition
 */
BlocklyDuino.loadToolboxDefinition = function(toolboxFile) {
    if (!toolboxFile) {
        toolboxFile = BlocklyDuino.getStringParamFromUrl('toolbox', '');
    }
    if (!toolboxFile) {
        toolboxFile = sessionStorage.getItem('toolbox');
    }
    if (!toolboxFile) {
        toolboxFile = BlocklyDuino.selectedToolbox;
    }

    $("#toolboxes").val(toolboxFile);
    // update buttons levels
    $('#toolbox_algo').removeClass("active");
    $('#toolbox_arduino_1').removeClass("active");
    $('#toolbox_arduino_2').removeClass("active");
    $('#toolbox_arduino_3').removeClass("active");
    $('#toolbox_arduino_4').removeClass("active");
    $('#toolbox_arduino_all').removeClass("active");
    $('#' + toolboxFile).addClass("active");

    BlocklyDuino.toggleFunctionsChoice();
    if (sessionStorage.getItem('catblocsort') == "F") {
        toolboxFile += '_functions';
    }

    $.ajax({
        type: "GET",
        url: "./toolbox/" + toolboxFile + ".xml",
        dataType: "xml",
        async: false
    }).done(function(data) {
        var toolboxXml = '<xml id="toolbox" style="display: none">';
        toolboxXml += $(data).find('toolbox').html();
        toolboxXml += '</xml>';
        $("#toolbox").remove();
        $('body').append(toolboxXml);
        $("xml").find("category").each(function() {
            // add attribute ID to keep categorie code
            if (!$(this).attr('id')) {
                $(this).attr('id', $(this).attr('name'));
                $(this).attr('name', Blockly.Msg[$(this).attr('name')]);
            }
        });
    }).fail(function(data) {
        $("#toolbox").remove();
        console.log('toolbox file problem');
    });
};

/**
 * Change toolbox definition
 */
BlocklyDuino.changeToolboxDefinition = function() {
    BlocklyDuino.loadToolboxDefinition($("#toolboxes").val());
    BlocklyDuino.openConfigToolbox();
};

BlocklyDuino.changeLevelToolboxDefinition = function(level) {
    BlocklyDuino.loadToolboxDefinition(level);
    BlocklyDuino.openConfigToolbox();
};


/**
 * Initialize Blockly.  Called on page load.
 */
BlocklyDuino.init = function() {
    // Set default language to English
    Code.LANG = 'en';

    // Set default font to Trebuchet MS
    document.body.style.fontFamily = "Trebuchet MS";

    BlocklyDuino.setOrientation();
    BlocklyDuino.testAjax();

    if ($('#toolbox').length) {
        BlocklyDuino.toolboxInIndexHtml = true;
    }

    if (!BlocklyDuino.toolboxInIndexHtml && BlocklyDuino.ajaxOK) {
        BlocklyDuino.loadToolboxDefinition();
    }

    Code.initLanguage();

    // Set maximized view as default
            $("#menuPanel").css({ "display": "none" });
            // maximize div
            $("#divTabpanel").css({ "margin-left": "0px" });
            $('#btn_size').attr("title", MSG['btn_size_min']);
            $('#divTitre').addClass("hidden");
            $('#div_toolboxes').addClass("hidden");
            $('#divTitreMenu').removeClass("hidden");
            $('#icon_btn_size').removeClass('glyphicon-resize-full');
            $('#icon_btn_size').addClass('glyphicon-resize-small');
            $('#div_toolboxes').prepend($('#toolboxes'));

    BlocklyDuino.setArduinoBoard();

    // build Blockly ...
    BlocklyDuino.workspace = Blockly.inject('content_blocks', {
        grid: {
            spacing: 25,
            length: 3,
            colour: '#ccc',
            snap: true
        },
        sounds: true,
        media: 'media/',
        rtl: Code.isRtl(),
        toolbox: BlocklyDuino.buildToolbox(),
        zoom: {
            controls: true,
            wheel: true
        }
    });
    // bind events to html elements
    BlocklyDuino.bindFunctions();

    BlocklyDuino.renderContent();

    BlocklyDuino.workspace.addChangeListener(BlocklyDuino.renderArduinoCodePreview);

    // load blocks stored in session or passed by url
    var urlFile = BlocklyDuino.getStringParamFromUrl('url', '');
    var loadOnce = null;
    try {
        loadOnce = sessionStorage.getItem('loadOnceBlocks');
    } catch (e) {
        // Firefox sometimes throws a SecurityError when accessing
        // localStorage.
        // Restarting Firefox fixes this, so it looks like a bug.
    }
    if (urlFile) {
        if (loadOnce != null) {
            if (!confirm(MSG['xmlLoad'])) {
                BlocklyDuino.loadBlocks();
            }
        }
        $.get(urlFile, function(data) {
            BlocklyDuino.loadBlocks(data);
        }, 'text');
    } else {
        BlocklyDuino.loadBlocks();
    }

    // Hook a save function onto unload.
    window.addEventListener('unload', BlocklyDuino.backupBlocks, false);

    //global config
    BlocklyDuino.initBlocSort();

    /*pour changer couleur texte dans toolbox */
    //    $("div:contains('bitbloq').blocklyTreeRow, div:contains('bitbloq').blocklyTreeRow ~ div").on("click", function() {
    //        $(this).removeClass("blocklyTreeSelected")
    //        $(this).find("span").removeClass("blocklyTreeIconNone")
    //        $(this).find("span").addClass('blocklyTreeIcon fa fa-cloud');
    //    });

    if (window.location.protocol == 'http:') {
        $("#btn_create_example, menu_132").attr("href", "./examples/examples.php?lang=" + Code.LANG);
    } else {
        $("#btn_create_example, menu_132").attr("href", "./examples/examples.html?lang=" + Code.LANG);
    }

    BlocklyDuino.OnOffLine();
    BlocklyDuino.ExampleWiring();
};

/**
 * Create content for modal example
 */
BlocklyDuino.buildExamples = function() {
    var search = window.location.search;
    // remove values from url
    search = search.replace(/([?&]url=)[^&]*/, '');

    $.ajax({
        cache: false,
        url: "./examples/examples.json",
        dataType: "json",
        success: function(data) {
            $("#includedContent").empty();
            $.each(data, function(i, example) {
                if (example.visible) {
                    var line = "<tr>" +
                        "<td><a href='" + search + "&url=./examples/" + example.source_url + "'>" +
                        example.source_text +
                        "</a></td>" +
                        "<td>" +
                        "<a href='./examples/" + example.image + "' target=_blank>" +
                        "<img class='vignette' src='./examples/" + example.image + "'>" +
                        "</a>" +
                        "</td>" +
                        "<td>" +
                        "<a href='./examples/" + example.link_url + "' target=_blank>" +
                        example.link_text +
                        "</a>" +
                        "</td>" +
                        "</tr>";

                    $("#includedContent").append(line);
                }
            });
        }
    });
};


/**
 * Test ajax request 
 */
BlocklyDuino.testAjax = function() {
    $.ajax({
        type: "GET",
        url: "./index.html",
        dataType: 'text',
        error: function() {
            if (window.sessionStorage && !sessionStorage.getItem('msg_ajax_seen')) {
                $('#ajaxModal').modal('show');
            }
            BlocklyDuino.ajaxOK = false;
        }
    });
};

/**
 * Override Blockly method (/Blockly/core/variable.js)
 * To add the block "variables_set_type"
 * 
 * Construct the blocks required by the flyout for the variable category.
 * @param {!Blockly.Workspace} workspace The workspace contianing variables.
 * @return {!Array.<!Element>} Array of XML block elements.
 */
Blockly.Variables.flyoutCategory = function(workspace) {
    var variableList = workspace.variableList;
    variableList.sort(goog.string.caseInsensitiveCompare);

    var xmlList = [];
    var button = goog.dom.createDom('button');
    button.setAttribute('text', Blockly.Msg.NEW_VARIABLE);
    button.setAttribute('callbackKey', 'CREATE_VARIABLE');

    Blockly.registerButtonCallback('CREATE_VARIABLE', function(button) {
        Blockly.Variables.createVariable(button.getTargetWorkspace());
    });

    xmlList.push(button);

    if (variableList.length > 0) {
        if (Blockly.Blocks['variables_set']) {
            // <block type="variables_set" gap="20">
            //   <field name="VAR">item</field>
            // </block>
            var block = goog.dom.createDom('block');
            block.setAttribute('type', 'variables_set');
            if (Blockly.Blocks['variables_set_type']) {
                block.setAttribute('gap', 8);
            } else {
                block.setAttribute('gap', 24);
            }
            var field = goog.dom.createDom('field', null, variableList[0]);
            field.setAttribute('name', 'VAR');
            block.appendChild(field);
            xmlList.push(block);
        }
        if (Blockly.Blocks['variables_const']) {
            // <block type="variables_const" gap="20">
            //   <field name="VAR">item</field>
            // </block>
            var block = goog.dom.createDom('block');
            block.setAttribute('type', 'variables_const');
            if (Blockly.Blocks['variables_set_type']) {
                block.setAttribute('gap', 8);
            } else {
                block.setAttribute('gap', 24);
            }
            var field = goog.dom.createDom('field', null, variableList[0]);
            field.setAttribute('name', 'VAR');
            block.appendChild(field);
            xmlList.push(block);
        }
        // override to inject variables_set_type block
        if (Blockly.Blocks['variables_set_type']) {
            var block = goog.dom.createDom('block');
            block.setAttribute('type', 'variables_set_type');
            if (Blockly.Blocks['math_change']) {
                block.setAttribute('gap', 8);
            } else {
                block.setAttribute('gap', 24);
            }
            xmlList.push(block);
        }
        // end override
        if (Blockly.Blocks['variables_set_init']) {
            var block = goog.dom.createDom('block');
            block.setAttribute('type', 'variables_set_init');
            if (Blockly.Blocks['variables_set_init']) {
                block.setAttribute('gap', 8);
            } else {
                block.setAttribute('gap', 24);
            }
            xmlList.push(block);
        }
        if (Blockly.Blocks['math_change']) {
            // <block type="math_change">
            //   <value name="DELTA">
            //     <shadow type="math_number">
            //       <field name="NUM">1</field>
            //     </shadow>
            //   </value>
            // </block>
            var block = goog.dom.createDom('block');
            block.setAttribute('type', 'math_change');
            if (Blockly.Blocks['variables_get']) {
                block.setAttribute('gap', 20);
            }
            var value = goog.dom.createDom('value');
            value.setAttribute('name', 'DELTA');
            block.appendChild(value);

            var field = goog.dom.createDom('field', null, variableList[0]);
            field.setAttribute('name', 'VAR');
            block.appendChild(field);

            var shadowBlock = goog.dom.createDom('shadow');
            shadowBlock.setAttribute('type', 'math_number');
            value.appendChild(shadowBlock);

            var numberField = goog.dom.createDom('field', null, '1');
            numberField.setAttribute('name', 'NUM');
            shadowBlock.appendChild(numberField);

            xmlList.push(block);
        }

        for (var i = 0; i < variableList.length; i++) {
            if (Blockly.Blocks['variables_get']) {
                // <block type="variables_get" gap="8">
                //   <field name="VAR">item</field>
                // </block>
                var block = goog.dom.createDom('block');
                block.setAttribute('type', 'variables_get');
                if (Blockly.Blocks['variables_set']) {
                    block.setAttribute('gap', 8);
                }
                var field = goog.dom.createDom('field', null, variableList[i]);
                field.setAttribute('name', 'VAR');
                block.appendChild(field);
                xmlList.push(block);
            }
        }
    }
    return xmlList;
};
/*
BlocklyDuino.openWiringDialog = function() {
	var iframe = $("#wiring_dialog > iframe");
	var dialog = $("#wiring_dialog").dialog({
		autoOpen: false,
		resizable: true,
		height: 600,
		width: 800,
		show: {
			effect: "slide",
			duration: 1000
		  },
		hide: {
			effect: "drop",
			duration: 1000
		  }
	});
	iframe.attr({
		width: "100%",
		height: "100%",
		src: "https://fr.robom.ru"
	});
	if (!dialog.dialog("isOpen")) {
		dialog.dialog("open");
	}
};*/

BlocklyDuino.DialogCode = function() {
    var dialogCode = $("#pre_previewArduino").dialog({
        autoOpen: false,
        resizable: true,
        height: 600,
        width: 400,
        show: {
            effect: "drop",
            duration: 1000
        },
        hide: {
            effect: "drop",
            duration: 1000
        },
        position: {
            my: "right top",
            at: "right top",
            of: "#content_blocks"
        },
        buttons: [{
                text: "copy-paste",
                icon: {
                    primary: "btn btn_ver btn-danger btn-block"
                },
                click: BlocklyDuino.ArduinoIDEClick_IDE,
            },
            {
                text: 'save',
                icons: {
                    primary: "ui-icon-cancel"
                },
                click: BlocklyDuino.saveArduinoFile_IDE,
            },
            {
                text: 'upload',
                icons: {
                    primary: "ui-icon-cancel"
                },
                click: BlocklyDuino.uploadClick_IDE,
            }
        ]
    });
    if (!dialogCode.dialog("isOpen")) {
        dialogCode.dialog("open").dialog("option", "buttons");
    };
};

BlocklyDuino.DialogCode_edit = function() {
    $('#edit_code').val($('#pre_previewArduino').text());
    if (typeof prettyPrintOne == 'function') {
        $('#edit_code').html(prettyPrintOne($('#edit_code').html(), 'cpp'));
    }
    //$('#pre_previewArduino').addClass('hidden');

}

/*
 *  Store the blocks for the duration of the reload.
 */
BlocklyDuino.backupBlocks = function() {
    if (typeof Blockly != 'undefined' && sessionStorage) {
        var xml = Blockly.Xml.workspaceToDom(BlocklyDuino.workspace);
        var text = Blockly.Xml.domToText(xml);
        sessionStorage.setItem('loadOnceBlocks', text);
    }
};

/**
 * Load default Arduino structure blocks (void setup and void loop)
 * when the workspace is empty. This function is protected by a lock
 * to prevent race conditions.
 */
BlocklyDuino.loadDefaultArduinoBlocks = function() {
    // 1. Check lock to prevent this from running multiple times
    if (BlocklyDuino.loadingDefaultBlocks) {
        return;
    }
    // NEW GUARD: Prevent duplicate base_setup_loop blocks
    if (
        BlocklyDuino.workspace &&
        BlocklyDuino.workspace.getAllBlocks(false).some(
            function(block) { return block.type === 'base_setup_loop'; }
        )
    ) {
        return;
    }
    // Set lock IMMEDIATELY to prevent race conditions
    BlocklyDuino.loadingDefaultBlocks = true;
    setTimeout(function() {
        // 4. Final check: only load if the workspace is still empty
        if (BlocklyDuino.workspace && BlocklyDuino.workspace.getAllBlocks(false).length === 0) {
            
            // Check if block type is available
            if (!Blockly.Blocks['base_setup_loop']) {
                console.error('Arduino base_setup_loop block not available.');
                BlocklyDuino.loadingDefaultBlocks = false; // Release lock
                return;
            }
            
            console.log('Loading default Arduino blocks...');
            
            // Get workspace dimensions to center the blocks
            var metrics = BlocklyDuino.workspace.getMetrics();
            var centerX = Math.max(100, metrics.viewWidth / 2 - 100);
            var centerY = Math.max(100, metrics.viewHeight / 2 - 100);
            
            // XML-first approach with a manual creation fallback
            var success = false;
            try {
                var defaultXml = '<xml xmlns="https://developers.google.com/blockly/xml">' +
                    '<block type="base_setup_loop" x="' + centerX + '" y="' + centerY + '"></block>' +
                    '</xml>';
                var xml = Blockly.Xml.textToDom(defaultXml);
                var blockCount = Blockly.Xml.domToWorkspace(xml, BlocklyDuino.workspace);
                success = blockCount > 0;
            } catch (e) {
                console.error('XML block creation failed, trying manual approach.', e);
            }
            
            if (!success) {
                try {
                    var setupLoopBlock = BlocklyDuino.workspace.newBlock('base_setup_loop');
                    setupLoopBlock.moveBy(centerX, centerY);
                    setupLoopBlock.initSvg();
                    setupLoopBlock.render();
                    success = true;
                } catch (e) {
                    console.error('Manual block creation failed.', e);
                }
            }
            
            if (success) {
                BlocklyDuino.workspace.render();
                // Remove duplicate base_setup_loop blocks if any exist
                var setupLoopBlocks = BlocklyDuino.workspace.getAllBlocks(false).filter(function(block) {
                    return block.type === 'base_setup_loop';
                });
                if (setupLoopBlocks.length > 1) {
                    // Keep the first, remove the rest
                    for (var i = 1; i < setupLoopBlocks.length; i++) {
                        setupLoopBlocks[i].dispose(false, true);
                    }
                }
                // Center the view on the new block
                setTimeout(function() {
                    var topBlocks = BlocklyDuino.workspace.getTopBlocks(false);
                    if (topBlocks.length > 0) {
                        try {
                           BlocklyDuino.workspace.centerOnBlock(topBlocks[0].id);
                        } catch(e) {
                           console.error("Error centering on block. It may already be visible.", e);
                        }
                    }
                }, 50);
                 if (typeof BlocklyDuino.renderContent === 'function') {
                    BlocklyDuino.renderContent();
                }
            }
        }
        // 5. Release the lock once the operation is complete
        BlocklyDuino.loadingDefaultBlocks = false;
    }, 200);
};