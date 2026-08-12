-- Karabiner Layer Indicator - URL Handler
-- Provides a URL-based interface for Karabiner to control the layer indicator
-- Usage: open 'hammerspoon://layer_indicator?action=show&layer=space'
--
-- Layer Definition Loading:
-- - Attempts to load dynamic layer definitions from JSON (src/space_layers.json)
-- - Falls back to hardcoded definitions if JSON unavailable
-- - Toggleable debug mode via HAMMERSPOON_DEBUG environment variable

-- Visual indicator module with elegant GUI styling
local indicator = {}
local currentCanvas = nil
local currentKeyCanvas = nil

function indicator.showTable(layer_info)
    -- Hide previous display
    indicator.hide()

    if not layer_info or type(layer_info) ~= "table" then
        return
    end

    local label = layer_info.label or "?"
    local keys = layer_info.keys or {}
    local widthHint = layer_info.widthHintPx or 0

    -- Configuration
    local config = {
        x_offset = 20,
        y_offset = 80,
        icon_width = 60,
        icon_height = 60,
        corner_radius = 10,
        icon_font_size = 32,
        key_font_size = 16,
        desc_font_size = 12,
        font_name = "SF Pro Display",
        border_width = 3,
    }

    -- Color based on layer label
    local function getColor(lbl)
        local colors = {
            ["␣"] = { 0.5, 0.5, 0.5, 0.85 },
            ["A"] = { 0.2, 0.6, 1.0, 0.85 },
            ["M"] = { 0.8, 0.4, 1.0, 0.85 },
            ["C"] = { 0.8, 0.4, 1.0, 0.85 },
            ["D"] = { 1.0, 0.6, 0.2, 0.85 },
            ["F"] = { 0.3, 0.8, 0.4, 0.85 },
            ["S"] = { 1.0, 0.3, 0.3, 0.85 },
            ["W"] = { 1.0, 0.85, 0.0, 0.85 },
        }
        return colors[lbl] or colors["␣"]
    end

    local color = getColor(label)
    local screen = hs.screen.mainScreen()
    local frame = screen:frame()

    -- Icon position: bottom-right corner
    local icon_x = frame.x + frame.w - config.icon_width - config.x_offset
    local icon_y = frame.y + frame.h - config.icon_height - config.y_offset

    -- Create icon canvas
    currentCanvas = hs.canvas.new({
        x = icon_x,
        y = icon_y,
        w = config.icon_width,
        h = config.icon_height,
    })

    -- Icon background
    currentCanvas[1] = {
        type = "rectangle",
        action = "fill",
        fillColor = { red = color[1], green = color[2], blue = color[3], alpha = color[4] },
        roundedRectRadii = { xRadius = config.corner_radius, yRadius = config.corner_radius },
        frame = { x = 0, y = 0, w = config.icon_width, h = config.icon_height },
    }

    -- Icon border
    currentCanvas[2] = {
        type = "rectangle",
        action = "stroke",
        strokeColor = { red = 1.0, green = 0.9, blue = 0.0, alpha = 1.0 },
        strokeWidth = config.border_width,
        roundedRectRadii = { xRadius = config.corner_radius, yRadius = config.corner_radius },
        frame = { x = 0, y = 0, w = config.icon_width, h = config.icon_height },
    }

    -- Icon label
    currentCanvas[3] = {
        type = "text",
        text = label,
        textFont = config.font_name,
        textSize = config.icon_font_size,
        textColor = { white = 1.0, alpha = 1.0 },
        textAlignment = "center",
        frame = { x = 0, y = 5, w = config.icon_width, h = config.icon_height - 10 },
    }

    currentCanvas:level(hs.canvas.windowLevels.overlay)
    currentCanvas:behavior(
        hs.canvas.windowBehaviors.canJoinAllSpaces
        + hs.canvas.windowBehaviors.stationary
        + hs.canvas.windowBehaviors.ignoresCycle
    )
    currentCanvas:show()

    -- Draw key list if available
    if #keys > 0 then
        local padding = 10
        local line_height = math.max(config.key_font_size, config.desc_font_size) + 6

        -- Measure text widths
        local max_desc_width = 100
        local max_key_width = 30

        for _, item in ipairs(keys) do
            -- Create temp canvas for measurement
            local temp = hs.canvas.new({ x = 0, y = 0, w = 1, h = 1 })

            temp[1] = {
                type = "text",
                text = item.desc or "",
                textFont = config.font_name,
                textSize = config.desc_font_size,
            }
            local desc_size = temp:minimumTextSize(1, item.desc or "")
            if desc_size and desc_size.w then
                max_desc_width = math.max(max_desc_width, desc_size.w)
            end

            temp[1] = {
                type = "text",
                text = item.key or "",
                textFont = config.font_name,
                textSize = config.key_font_size,
            }
            local key_size = temp:minimumTextSize(1, item.key or "")
            if key_size and key_size.w then
                max_key_width = math.max(max_key_width, key_size.w)
            end

            temp:delete()
        end

        local key_width = math.max(30, math.ceil(max_key_width))
        local list_width = math.max(
            widthHint,
            math.ceil(max_desc_width + key_width + padding * 3)
        )
        local list_height = #keys * line_height + padding * 2

        local list_x = frame.x + frame.w - list_width - config.x_offset
        local list_y = icon_y - list_height - 10

        -- Create key list canvas
        currentKeyCanvas = hs.canvas.new({
            x = list_x,
            y = list_y,
            w = list_width,
            h = list_height,
        })

        local idx = 1

        -- List background
        currentKeyCanvas[idx] = {
            type = "rectangle",
            action = "fill",
            fillColor = { red = 0.1, green = 0.1, blue = 0.1, alpha = 0.9 },
            roundedRectRadii = { xRadius = config.corner_radius, yRadius = config.corner_radius },
            frame = { x = 0, y = 0, w = list_width, h = list_height },
        }
        idx = idx + 1

        -- List border
        currentKeyCanvas[idx] = {
            type = "rectangle",
            action = "stroke",
            strokeColor = { red = 1.0, green = 0.9, blue = 0.0, alpha = 1.0 },
            strokeWidth = config.border_width,
            roundedRectRadii = { xRadius = config.corner_radius, yRadius = config.corner_radius },
            frame = { x = 0, y = 0, w = list_width, h = list_height },
        }
        idx = idx + 1

        -- Draw key mappings
        for i, item in ipairs(keys) do
            local y_pos = padding + (i - 1) * line_height

            -- Description
            currentKeyCanvas[idx] = {
                type = "text",
                text = item.desc,
                textFont = config.font_name,
                textSize = config.desc_font_size,
                textColor = { white = 0.9, alpha = 1.0 },
                textAlignment = "left",
                frame = {
                    x = padding,
                    y = y_pos + 1,
                    w = list_width - key_width - padding * 2,
                    h = line_height,
                },
            }
            idx = idx + 1

            -- Key label (right-aligned, colored)
            currentKeyCanvas[idx] = {
                type = "text",
                text = item.key,
                textFont = config.font_name,
                textSize = config.key_font_size,
                textColor = { red = color[1], green = color[2], blue = color[3], alpha = 1.0 },
                textAlignment = "right",
                frame = {
                    x = list_width - key_width - padding,
                    y = y_pos,
                    w = key_width,
                    h = line_height,
                },
            }
            idx = idx + 1
        end

        currentKeyCanvas:level(hs.canvas.windowLevels.overlay)
        currentKeyCanvas:behavior(
            hs.canvas.windowBehaviors.canJoinAllSpaces
            + hs.canvas.windowBehaviors.stationary
            + hs.canvas.windowBehaviors.ignoresCycle
        )
        currentKeyCanvas:show()
    end
end

function indicator.hide()
    if currentCanvas then
        currentCanvas:delete()
        currentCanvas = nil
    end
    if currentKeyCanvas then
        currentKeyCanvas:delete()
        currentKeyCanvas = nil
    end
end

-- Hardcoded layer definitions (fallback if JSON loading fails)
local FALLBACK_LAYERS = {
    space = {
        label = "␣",
        keys = {
            { key = "A", desc = "Applications" },
            { key = "M", desc = "Cursor Movement" },
            { key = "C", desc = "Case" },
            { key = "D", desc = "Downloads" },
            { key = "F", desc = "Folders" },
            { key = "S", desc = "Screenshots" },
            { key = "W", desc = "Wrap" },
        },
        widthHintPx = 235,
    },

    space_A = {
        label = "A",
        keys = {
            { key = "8", desc = "RingCentral" },
            { key = "A", desc = "Apps" },
            { key = "B", desc = "Busycal" },
            { key = "C", desc = "Code" },
            { key = "D", desc = "Dia" },
            { key = "E", desc = "Proton Mail" },
            { key = "F", desc = "QSpace" },
            { key = "G", desc = "ChatGPT" },
            { key = "M", desc = "Messages" },
            { key = "O", desc = "Outlook" },
            { key = "P", desc = "Phone" },
            { key = "Q", desc = "QSpace" },
            { key = "R", desc = "RingCentral" },
            { key = "S", desc = "Safari" },
            { key = "T", desc = "Teams" },
            { key = "V", desc = "Code" },
            { key = "W", desc = "Word" },
        },
        widthHintPx = 235,
    },

    space_M = {
        label = "M",
        keys = {
            { key = ";", desc = "Page Down" },
            { key = "D", desc = "Delete" },
            { key = "F", desc = "Forward Delete" },
            { key = "I", desc = "Up" },
            { key = "J", desc = "Left" },
            { key = "K", desc = "Down" },
            { key = "L", desc = "Right" },
            { key = "O", desc = "End" },
            { key = "P", desc = "Page Up" },
            { key = "S", desc = "Shift" },
            { key = "U", desc = "Home" },
        },
        widthHintPx = 235,
    },

    space_C = {
        label = "C",
        keys = {
            { key = "L", desc = "lowercase" },
            { key = "S", desc = "Sentence case" },
            { key = "T", desc = "Title Case" },
            { key = "U", desc = "UPPERCASE" },
        },
        widthHintPx = 235,
    },

    space_D = {
        label = "D",
        keys = {
            { key = "3", desc = "3dPrinting" },
            { key = "A", desc = "Archives" },
            { key = "I", desc = "Installs" },
            { key = "O", desc = "Office" },
            { key = "P", desc = "PDFs" },
        },
        widthHintPx = 235,
    },

    space_F = {
        label = "F",
        keys = {
            { key = "`", desc = "Home" },
            { key = "A", desc = "Applications" },
            { key = "D", desc = "Downloads" },
            { key = "O", desc = "My OneDrive" },
            { key = "P", desc = "Proton Drive" },
            { key = "S", desc = "Scripts" },
            { key = "V", desc = "Videos" },
            { key = "W", desc = "Work OneDrive" },
        },
        widthHintPx = 235,
    },

    space_S = {
        label = "S",
        keys = {
            { key = "A", desc = "Capture Area" },
            { key = "O", desc = "OCR" },
            { key = "R", desc = "Record Screen" },
            { key = "S", desc = "Capture Screen" },
            { key = "W", desc = "Capture Window" },
        },
        widthHintPx = 235,
    },

    space_W = {
        label = "W",
        keys = {
            { key = "C", desc = "Curly Braces" },
            { key = "P", desc = "Parentheses" },
            { key = "Q", desc = "Quotes" },
            { key = "S", desc = "Square Brackets" },
        },
        widthHintPx = 235,
    },
}

-- Debug mode toggle - enable with: HAMMERSPOON_DEBUG=true hs -c ...
local DEBUG_MODE = os.getenv("HAMMERSPOON_DEBUG") == "true"
-- Optional hot reload toggle for development; keep disabled for normal runtime.
local RELOAD_ON_SHOW = os.getenv("HAMMERSPOON_LAYER_INDICATOR_RELOAD_ON_SHOW") == "true"

local function debug_log(message)
    if DEBUG_MODE then
        hs.printf("[LayerIndicator Debug] %s", message)
    end
end

-- Load layer definitions from JSON file
-- Returns dynamically loaded layers, or falls back to hardcoded definitions
local function loadLayerDefinitions()
    local home = os.getenv("HOME") or ""
    local json_paths = {
        home .. "/.config/hammerspoon/modules/karabiner_layer_gui/space_layers.json",
        home .. "/.hammerspoon/karabiner_layer_gui/space_layers.json",
    }

    for _, json_path in ipairs(json_paths) do
        debug_log("Attempting to load layers from: " .. json_path)

        local file = io.open(json_path, "r")
        if file then
            local content = file:read("*a")
            file:close()

            debug_log("JSON file found, attempting to decode...")

            local success, loaded_layers = pcall(function()
                return hs.json.decode(content)
            end)

            if success and loaded_layers then
                debug_log("Successfully loaded layer definitions from: " .. json_path)
                return loaded_layers
            end

            if not success then
                debug_log("JSON decode error in " .. json_path .. ": " .. tostring(loaded_layers))
            else
                debug_log("JSON decode returned nil/empty for: " .. json_path)
            end
        else
            debug_log("JSON file not found at: " .. json_path)
        end
    end

    debug_log("No valid JSON found, falling back to hardcoded definitions")
    return FALLBACK_LAYERS
end

-- Load layers at startup
local layers = loadLayerDefinitions()
-- Main URL event handler
local function showLayerByName(name)
    debug_log("showLayerByName called with: " .. tostring(name))
    -- Production default is cached definitions loaded at startup.
    -- Enable live reload only when explicitly requested for debugging.
    if RELOAD_ON_SHOW then
        layers = loadLayerDefinitions()
    end
    local info = layers[name]
    if not info then
        hs.printf("[LayerIndicator] Unknown layer: '%s'", tostring(name))
        debug_log("Layer not found: " .. tostring(name))
        return
    end
    debug_log("Displaying layer: " .. name .. " with " .. tostring(#(info.keys or {})) .. " keys")
    indicator.showTable(info)
end

-- Register the URL event handler
-- URL format: hammerspoon://layer_indicator?action=show&layer=space
--             hammerspoon://layer_indicator?action=hide
hs.urlevent.bind("layer_indicator", function(_eventName, params)
    local action = params.action or "show"

    debug_log("URL event received - action: " .. tostring(action) .. ", layer: " .. tostring(params.layer))
    if action == "hide" then
        indicator.hide()
    elseif action == "show" then
        showLayerByName(params.layer or "space")
    else
        hs.printf("[LayerIndicator] Unknown action: '%s'", tostring(action))
        debug_log("Unknown action: " .. tostring(action))
    end
end)

hs.printf("[LayerIndicator] URL handler registered (hammerspoon://layer_indicator)")
debug_log("Layer definitions loaded. Total layers: " .. tostring(#(layers or {})))

return {
    showLayerByName = showLayerByName,
    loadLayerDefinitions = loadLayerDefinitions,
    layers = layers,
    DEBUG_MODE = DEBUG_MODE,
}
