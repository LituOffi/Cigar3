(function() {
    "use strict";
    if (navigator.appVersion.indexOf("MSIE") != -1)
        alert("You're using a pretty old browser, some parts of the website might not work properly.");

    if (typeof WebSocket == "undefined" || typeof DataView == "undefined" || typeof ArrayBuffer == "undefined" || typeof Uint8Array == "undefined")
        return alert("Your browser does not support required functions, please update your browser or get a good one (Firefox will work perfectly)");

    function byId(id, parent = document) {return parent.getElementById(id)}
    function byClass(clss, parent = document) {
        return parent.getElementsByClassName(clss);
    }

    Date.now || (Date.now = function() {
        return (+new Date).getTime();
    });
    var LOAD_START = Date.now();
    Array.prototype.peek = function() {
        return this[this.length - 1];
    };
    Array.prototype.remove = function(a) {
        var i = this.indexOf(a);
        if (i !== -1) this.splice(i, 1);
        return i !== -1;
    };
    Element.prototype.hide = function() {
        this.style.display = "none";
        if (this.style.opacity == 1) this.style.opacity = 0;
    };
    Element.prototype.show = function(seconds) {
        this.style.display = "";
        var that = this;
        if (seconds) {
            this.style.transition = `opacity ${seconds}s ease 0s`;
            setTimeout(function() {
                that.style.opacity = 1;
            }, 20);
        }
    };
    function bytesToHex(r, g, b) {
        return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
    }
    function colorToBytes(color) {
        var c = color.slice(1);
        if (c.length === 3) c = c.split("").map(function(a) {return a + a});
        if (c.length !== 6) throw new Error(`invalid color ${color}`);
        var v = parseInt(c, 16);
        return {
            r: v >>> 16 & 255,
            g: v >>> 8 & 255,
            b: v & 255
        };
    }
    function darkenColor(color) {
        var a = colorToBytes(color);
        return bytesToHex(a.r * .9, a.g * .9, a.b * .9);
    }
    function cleanupObject(object) {
        for (var i in object)
            delete object[i];
    }
    var __buf = new DataView(new ArrayBuffer(8));
    function Writer(littleEndian) {
        this._e = littleEndian;
        this.reset();
        return this;
    }
    Writer.prototype = {
        writer: true,
        reset: function(littleEndian) {
            this._b = [];
            this._o = 0;
        },
        setUint8: function(a) {
            if (a >= 0 && a < 256) this._b.push(a);
            return this;
        },
        setInt8: function(a) {
            if (a >= -128 && a < 128) this._b.push(a);
            return this;
        },
        setUint16: function(a) {
            __buf.setUint16(0, a, this._e);
            this._move(2);
            return this;
        },
        setInt16: function(a) {
            __buf.setInt16(0, a, this._e);
            this._move(2);
            return this;
        },
        setUint32: function(a) {
            __buf.setUint32(0, a, this._e);
            this._move(4);
            return this;
        },
        setInt32: function(a) {
            __buf.setInt32(0, a, this._e);
            this._move(4);
            return this;
        },
        setFloat32: function(a) {
            __buf.setFloat32(0, a, this._e);
            this._move(4);
            return this;
        },
        setFloat64: function(a) {
            __buf.setFloat64(0, a, this._e);
            this._move(8);
            return this;
        },
        _move: function(b) {
            for (var i = 0; i < b; i++) this._b.push(__buf.getUint8(i));
        },
        setStringUTF8: function(s) {
            var bytesStr = unescape(encodeURIComponent(s));
            for (var i = 0, l = bytesStr.length; i < l; i++) this._b.push(bytesStr.charCodeAt(i));
            this._b.push(0);
            return this;
        },
        build: function() {
            return new Uint8Array(this._b);
        }
    };
    function Reader(view, offset, littleEndian) {
        this._e = littleEndian;
        if (view) this.repurpose(view, offset);
    }
    Reader.prototype = {
        reader: true,
        repurpose: function(view, offset) {
            this.view = view;
            this._o = offset || 0;
        },
        getUint8: function() {
            return this.view.getUint8(this._o++, this._e);
        },
        getInt8: function() {
            return this.view.getInt8(this._o++, this._e);
        },
        getUint16: function() {
            return this.view.getUint16((this._o += 2) - 2, this._e);
        },
        getInt16: function() {
            return this.view.getInt16((this._o += 2) - 2, this._e);
        },
        getUint32: function() {
            return this.view.getUint32((this._o += 4) - 4, this._e);
        },
        getInt32: function() {
            return this.view.getInt32((this._o += 4) - 4, this._e);
        },
        getFloat32: function() {
            return this.view.getFloat32((this._o += 4) - 4, this._e);
        },
        getFloat64: function() {
            return this.view.getFloat64((this._o += 8) - 8, this._e);
        },
        getStringUTF8: function() {
            var s = "", b;
            while ((b = this.view.getUint8(this._o++)) !== 0) s += String.fromCharCode(b);

            return decodeURIComponent(escape(s));
        }
    };
    var log = {
        verbosity: 4,
        error: function() {
            if (log.verbosity > 0) console.error.apply(null, arguments);
        },
        warn: function() {
            if (log.verbosity > 1) console.warn.apply(null, arguments);
        },
        info: function() {
            if (log.verbosity > 2) console.info.apply(null, arguments);
        },
        debug: function() {
            if (log.verbosity > 3) console.debug.apply(null, arguments);
        }
    };

    var wsUrl = null,
        SKIN_URL = "./skins/",
        USE_HTTPS = "https:" == window.location.protocol,
        PI_2 = Math.PI * 2,
        SEND_254 = new Uint8Array([254, 6, 0, 0, 0]),
        SEND_255 = new Uint8Array([255, 1, 0, 0, 0]),
        UINT8_CACHE = {
            1: new Uint8Array([1]),
            17: new Uint8Array([17]),
            21: new Uint8Array([21]),
            18: new Uint8Array([18]),
            19: new Uint8Array([19]),
            22: new Uint8Array([22]),
            23: new Uint8Array([23]),
            24: new Uint8Array([24]),
            25: new Uint8Array([25]),
            254: new Uint8Array([254])
        },
        KEY_TO_CODE = {
            " ": UINT8_CACHE[17],
            "w": UINT8_CACHE[21],
            "q": UINT8_CACHE[18],
            "e": UINT8_CACHE[22],
            "r": UINT8_CACHE[23],
            "t": UINT8_CACHE[24],
            "p": UINT8_CACHE[25]
        };

    function wsCleanup() {
        if (!ws) return;
        log.debug("ws cleanup trigger");
        ws.onopen = null;
        ws.onmessage = null;
        ws.close();
        ws = null;
    }
    function wsInit(url) {
        if (ws) {
            log.debug("ws init on existing conn");
            wsCleanup();
        }
        byId("connecting").show(0.5);
        ws = new WebSocket(`ws${USE_HTTPS ? "s" : ""}://${wsUrl = url}`);
        ws.binaryType = "arraybuffer";
        ws.onopen = wsOpen;
        ws.onmessage = wsMessage;
        ws.onerror = wsError;
        ws.onclose = wsClose;
    }
    function wsOpen() {
        disconnectDelay = 1000;
        byId("connecting").hide();
        wsSend(SEND_254);
        wsSend(SEND_255);
    }
    function wsError(error) {
        log.warn(error);
    }
    function wsClose(e) {
        log.debug(`ws disconnected ${e.code} '${e.reason}'`);
        wsCleanup();
        gameReset();
        setTimeout(function() {
            if (ws && ws.readyState === 1) return;
            wsInit(wsUrl);
        }, disconnectDelay *= 1.5);
    }
    function wsSend(data) {
        if (!ws) return;
        if (ws.readyState !== 1) return;
        if (data.build) ws.send(data.build());
        else ws.send(data);
    }
    function wsMessage(data) {
        syncUpdStamp = Date.now();
        var reader = new Reader(new DataView(data.data), 0, true);
        var packetId = reader.getUint8();
        switch (packetId) {
            case 0x10: // update nodes
                var killer, killed, id, node, x, y, s, flags, cell,
                    updColor, updName, updSkin, count, color, name, skin;

                // consume records
                count = reader.getUint16();
                for (var i = 0; i < count; i++) {
                    killer = reader.getUint32();
                    killed = reader.getUint32();
                    if (!cells.byId.hasOwnProperty(killer) || !cells.byId.hasOwnProperty(killed))
                        continue;
                    if (settings.playSounds && cells.mine.includes(killer)) {
                        (cells.byId[killed].s < 20 ? pelletSound : eatSound).play(parseFloat(soundsVolume.value));
                    }
                    cells.byId[killed].destroy(killer);
                }

                // update records
                while (true) {
                    id = reader.getUint32();
                    if (id === 0) break;

                    x = reader.getInt32();
                    y = reader.getInt32();
                    s = reader.getUint16();

                    flags = reader.getUint8();
                    updColor = !!(flags & 0x02);
                    updName = !!(flags & 0x08);
                    updSkin = !!(flags & 0x04);
                    color = updColor ? bytesToHex(reader.getUint8(), reader.getUint8(), reader.getUint8()) : null;
                    skin = updSkin ? reader.getStringUTF8() : null;
                    name = updName ? reader.getStringUTF8() : null;

                    if (cells.byId.hasOwnProperty(id)) {
                        cell = cells.byId[id];
                        cell.update(syncUpdStamp);
                        cell.updated = syncUpdStamp;
                        cell.ox = cell.x;
                        cell.oy = cell.y;
                        cell.os = cell.s;
                        cell.nx = x;
                        cell.ny = y;
                        cell.ns = s;
                        if (color) cell.setColor(color);
                        if (skin) cell.setSkin(skin);
                        if (name) cell.setName(name);
                    } else {
                        cell = new Cell(id, x, y, s, name, color, skin, flags);
                        cells.byId[id] = cell;
                        cells.list.push(cell);
                    }
                }
                // dissapear records
                count = reader.getUint16();
                for (i = 0; i < count; i++) {
                    killed = reader.getUint32();
                    if (cells.byId.hasOwnProperty(killed) && !cells.byId[killed].destroyed)
                        cells.byId[killed].destroy(null);
                }
                break;
            case 0x11: // update pos
                targetX = reader.getFloat32();
                targetY = reader.getFloat32();
                targetZ = reader.getFloat32();
                break;
            case 0x12: // clear all
                for (var i in cells.byId)
                    cells.byId[i].destroy(null);
            case 0x14: // clear my cells
                cells.mine = [];
                break;
            case 0x15: // draw line
                log.warn("got packer 0x15 (draw line) which is unsupported");
                break;
            case 0x20: // new cell
                cells.mine.push(reader.getUint32());
                break;
            case 0x30: // text list
                leaderboard.items = [];
                leaderboard.type = "text";

                var count = reader.getUint32();
                for (i = 0; i < count; ++i)
                    leaderboard.items.push(reader.getStringUTF8());
                drawLeaderboard();
                break;
            case 0x31: // ffa list
                leaderboard.items = [];
                leaderboard.type = "ffa";

                var count = reader.getUint32();
                for (i = 0; i < count; ++i)
                    leaderboard.items.push({
                        me: !!reader.getUint32(),
                        name: reader.getStringUTF8() || "An unnamed cell"
                    });
                drawLeaderboard();
                break;
            case 0x32: // pie chart
                leaderboard.items = [];
                leaderboard.type = "pie";

                var count = reader.getUint32();
                for (i = 0; i < count; ++i)
                    leaderboard.items.push(reader.getFloat32());
                drawLeaderboard();
                break;
            case 0x40: // set border
                border.left = reader.getFloat64();
                border.top = reader.getFloat64();
                border.right = reader.getFloat64();
                border.bottom = reader.getFloat64();
                border.width = border.right - border.left;
                border.height = border.bottom - border.top;
                border.centerX = (border.left + border.right) / 2;
                border.centerY = (border.top + border.bottom) / 2;
                if (data.data.byteLength === 33) break;
                if (!mapCenterSet) {
                    mapCenterSet = true;
                    cameraX = targetX = border.centerX;
                    cameraY = targetY = border.centerY;
                    cameraZ = targetZ = 1;
                }
                reader.getUint32(); // game type
                if (!/MultiOgar|OgarII/.test(reader.getStringUTF8()) || stats.pingLoopId) break;
                stats.pingLoopId = setInterval(function() {
                    wsSend(UINT8_CACHE[254]);
                    stats.pingLoopStamp = Date.now();
                }, 2000);
                break;
            case 0x63: // chat message
                var flags = reader.getUint8();
                var color = bytesToHex(reader.getUint8(), reader.getUint8(), reader.getUint8());

                var name = reader.getStringUTF8().trim();
                var reg = /\{([\w]+)\}/.exec(name);
                if (reg) name = name.replace(reg[0], "").trim();
                var message = reader.getStringUTF8();

                var server = !!(flags & 0x80),
                    admin = !!(flags & 0x40),
                    mod = !!(flags & 0x20);

                if (server && name !== "SERVER") name = "[SERVER] " + name;
                if (admin) name = "[ADMIN] " + name;
                if (mod) name = "[MOD] " + name;
                var wait = Math.max(3000, 1000 + message.length * 150);
                chat.waitUntil = syncUpdStamp - chat.waitUntil > 1000 ? syncUpdStamp + wait : chat.waitUntil + wait;
                chat.messages.push({
                    server: server,
                    admin: admin,
                    mod: mod,
                    color: color,
                    name: name,
                    message: message,
                    time: syncUpdStamp
                });
                if (settings.showChat) drawChat();
                break;
            case 0xFE: // server stat
                stats.info = JSON.parse(reader.getStringUTF8());
                stats.latency = syncUpdStamp - stats.pingLoopStamp;
                drawStats();
                break;
            default:
                // invalid packet
                wsCleanup();
                break;
        }
    }
    function sendMouseMove(x, y) {
        var writer = new Writer(true);
        writer.setUint8(0x10);
        writer.setUint32(x);
        writer.setUint32(y);
        writer._b.push(0, 0, 0, 0);
        wsSend(writer);
    }
    function sendPlay(name) {
        var writer = new Writer(true);
        writer.setUint8(0x00);
        writer.setStringUTF8(name);
        wsSend(writer);
    }
    function sendChat(text) {
        var writer = new Writer();
        writer.setUint8(0x63);
        writer.setUint8(0);
        writer.setStringUTF8(text);
        wsSend(writer);
    }

    function gameReset() {
        cleanupObject(cells);
        cleanupObject(border);
        cleanupObject(leaderboard);
        cleanupObject(chat);
        cleanupObject(stats);
        chat.messages = [];
        leaderboard.items = [];
        cells.mine = [];
        cells.byId = { };
        cells.list = [];
        cameraX = cameraY = targetX = targetY = 0;
        cameraZ = targetZ = 1;
        mapCenterSet = false;
    }

    var cells = Object.create({
        mine: [],
        byId: { },
        list: [],
    });
    var border = Object.create({
        left: -2000,
        right: 2000,
        top: -2000,
        bottom: 2000,
        width: 4000,
        height: 4000,
        centerX: -1,
        centerY: -1
    });
    var leaderboard = Object.create({
        type: NaN,
        items: null,
        canvas: document.createElement("canvas"),
        teams: ["#F33", "#3F3", "#33F"]
    });
    var chat = Object.create({
        messages: [],
        waitUntil: 0,
        canvas: document.createElement("canvas"),
        visible: false,
    });
    var stats = Object.create({
        framesPerSecond: 0,
        latency: NaN,
        supports: null,
        info: null,
        pingLoopId: NaN,
        pingLoopStamp: null,
        canvas: document.createElement("canvas"),
        visible: false,
        score: NaN,
        maxScore: 0
    });

    var ws = null;
    var wsUrl = null;
    var disconnectDelay = 1000;

    var syncUpdStamp = Date.now();
    var syncAppStamp = Date.now();

    var mainCanvas = null;
    var mainCtx = null;
    var soundsVolume;
    var knownSkins = { };
    var loadedSkins = { };
    var escOverlayShown = false;
    var isTyping = false;
    var chatBox = null;
    var mapCenterSet = false;
    var minionControlled = false;
    var cameraX = 0;
    var cameraY = 0;
    var cameraZ = 1;
    var cameraZInvd = 1;
    var targetX = 0;
    var targetY = 0;
    var targetZ = 1;
    var viewMult = 1;
    var mouseX = NaN;
    var mouseY = NaN;
    var mouseZ = 1;
    var skinList = [];
    var macroCooldown = 1000 / 7;
    var macroIntervalID;

    var settings = {
        nick: "",
        skin: "",
        gamemode: "",
        showSkins: true,
        showNames: true,
        darkTheme: false,
        showColor: true,
        showMass: false,
        showTextOutline: true,
        _showChat: true,
        get showChat() {
            return this._showChat;
        },
        set showChat(a) {
            var chat = byId("chat_textbox");
            a ? chat.show() : chat.hide();
            this._showChat = a;
        },
        showMinimap: true,
        showPosition: false,
        showBorder: false,
        showGrid: true,
        playSounds: false,
        soundsVolume: 0.5,
        moreZoom: false
    };
    var pressed = {
        " ": false,
        "w": false,
        "e": false,
        "r": false,
        "t": false,
        "p": false,
        "q": false,
        "escape": false
    };

    const eatSound = new Sound("./assets/sound/eat.mp3", 0.5, 10);
    const pelletSound = new Sound("./assets/sound/pellet.mp3", 0.5, 10);

    request("skinList.txt", function(data) {
        var skins = data.split(",");
        var stamp = Date.now();
        for (var i = 0; i < skins.length; i++)
            knownSkins[skins[i]] = stamp;
        for (var i in knownSkins)
            if (knownSkins[i] !== stamp) delete knownSkins[i];
    });

    function hideESCOverlay() {
        escOverlayShown = false;
        byId("overlays").hide();
    }
    function showESCOverlay() {
        escOverlayShown = true;
        byId("overlays").show(0.5);
    };

    function toCamera(ctx) {
        ctx.translate(mainCanvas.width / 2, mainCanvas.height / 2);
        scaleForth(ctx);
        ctx.translate(-cameraX, -cameraY);
    }
    function scaleForth(ctx) { ctx.scale(cameraZ, cameraZ); }
    function scaleBack(ctx) { ctx.scale(cameraZInvd, cameraZInvd); }
    function fromCamera(ctx) {
        ctx.translate(cameraX, cameraY);
        scaleBack(ctx);
        ctx.translate(-mainCanvas.width / 2, -mainCanvas.height / 2);
    }

    function initSetting(id, elm) {
        function simpleAssignListen(id, elm, prop) {
            if (settings[id] !== "") elm[prop] = settings[id];
            elm.addEventListener("change", function() {
                settings[id] = elm[prop];
            });
        }
        switch (elm.tagName.toLowerCase()) {
            case "input":
                switch (elm.type.toLowerCase()) {
                    case "range":
                    case "text":
                        simpleAssignListen(id, elm, "value");
                        break;
                    case "checkbox":
                        simpleAssignListen(id, elm, "checked");
                        break;
                }
                break;
            case "select":
                simpleAssignListen(id, elm, "value");
                break;
        }
    }
    function loadSettings() {
        var text = localStorage.getItem("settings");
        if (text) {
            var obj = JSON.parse(text);
            for (var prop in obj)
                if (settings.hasOwnProperty(prop))
                    settings[prop] = obj[prop];
        }
        for (var id in settings) {
            var elm = byId(id.charAt(0)  == "_" ? id.slice(1) : id);
            if (elm) {
                initSetting(id, elm);
            } else {
                log.warn(`element for setting ${id} doesn't exist.`);
            }
        }
    }
    function storeSettings() {
        localStorage.setItem("settings", JSON.stringify(settings));
    }

    function request(url, callback, method = "GET", type = "text") {
        var req = new XMLHttpRequest();
        req.onload = function() {
            callback(this.response);
        };
        req.responseType = type;
        req.open(method, url);
        req.send();
    }

    function buildGallery() {
        byId("gallery-body").innerHTML = `
        <ul id="skinsUL">
            ${Object.keys(knownSkins).sort().map(name => `
                <li class="skin" onclick="changeSkin('${name}')">
                    <img class="circular" src="${"./skins/" + name + ".png"}">
                    <h4 class="skinName">${name}</h4>
                </li>
            `).join("\n")}
        </ul>`;
    }

    function drawChat() {
        if (chat.messages.length === 0 && settings.showChat)
            return chat.visible = false;
        chat.visible = true;
        var canvas = chat.canvas;
        var ctx = canvas.getContext("2d");
        var latestMessages = chat.messages.slice(-15);
        var lines = [];
        for (var i = 0, len = latestMessages.length; i < len; i++)
            lines.push([
                {
                    text: latestMessages[i].name,
                    color: latestMessages[i].color
                }, {
                    text: " " + latestMessages[i].message,
                    color: settings.darkTheme ? "#FFF" : "#000"
                }
            ]);
        var width = 0;
        var height = 20 * len + 2;
        for (var i = 0; i < len; i++) {
            var thisLineWidth = 0;
            var complexes = lines[i];
            for (var j = 0; j < complexes.length; j++) {
                ctx.font = "18px Ubuntu";
                complexes[j].width = ctx.measureText(complexes[j].text).width;
                thisLineWidth += complexes[j].width;
            }
            width = Math.max(thisLineWidth, width);
        }
        canvas.width = width;
        canvas.height = height;
        for (var i = 0; i < len; i++) {
            width = 0;
            var complexes = lines[i];
            for (var j = 0; j < complexes.length; j++) {
                ctx.font = "18px Ubuntu";
                ctx.fillStyle = complexes[j].color;
                ctx.fillText(complexes[j].text, width, 20 * (1 + i));
                width += complexes[j].width;
            }
        }
    }

    function drawStats() {
        if (!stats.info) return stats.visible = false;
        stats.visible = true;

        var canvas = stats.canvas;
        var ctx = canvas.getContext("2d");
        ctx.font = "14px Ubuntu";
        var rows = [
            `${stats.info.name} (${stats.info.mode})`,
            `${stats.info.playersTotal} / ${stats.info.playersLimit} players`,
            `${stats.info.playersAlive} playing`,
            `${stats.info.playersSpect} spectating`,
            `${(stats.info.update * 2.5).toFixed(1)}% load @ ${prettyPrintTime(stats.info.uptime)}`
        ];
        var width = 0;
        for (var i = 0; i < rows.length; i++)
            width = Math.max(width, 2 + ctx.measureText(rows[i]).width + 2);
        canvas.width = width;
        canvas.height = rows.length * (14 + 2);
        ctx.font = "14px Ubuntu";
        ctx.fillStyle = settings.darkTheme ? "#AAA" : "#555";
        ctx.textBaseline = "top";
        for (var i = 0; i < rows.length; i++)
            ctx.fillText(rows[i], 2, -2 + i * (14 + 2));
    }

    function drawPosition() {
        if(!settings.showPosition) return;
        var width = 200 * (border.width / border.height);
        var height = 40 * (border.height / border.width);

        var beginX = mainCanvas.width / viewMult - width;
        var beginY = mainCanvas.height / viewMult - height;

        if (settings.showMinimap) beginY = beginY - 10 - 200 * border.height / border.width;

        mainCtx.fillStyle = "#000";
        mainCtx.globalAlpha = 0.4;
        mainCtx.fillRect(beginX, beginY, width, height);
        mainCtx.globalAlpha = 1;

        mainCtx.fillStyle = "#FFF";
        drawRaw(mainCtx, beginX+width/2, beginY+height/2, 'X: ' + ~~cameraX + ', Y: ' + ~~cameraY);
    }

    function prettyPrintTime(seconds) {
        seconds = ~~seconds;
        var minutes = ~~(seconds / 60);
        if (minutes < 1) return "<1 min";
        var hours = ~~(minutes / 60);
        if (hours < 1) return minutes + "min";
        var days = ~~(hours / 24);
        if (days < 1) return hours + "h";
        return days + "d";
    }

    function drawLeaderboard() {
        if (leaderboard.type === NaN) return leaderboard.visible = false;
        if (!settings.showNames || leaderboard.items.length === 0)
            return leaderboard.visible = false;
        leaderboard.visible = true;
        var canvas = leaderboard.canvas;
        var ctx = canvas.getContext("2d");
        var len = leaderboard.items.length;

        canvas.width = 200;
        canvas.height = leaderboard.type !== "pie" ? 60 + 24 * len : 240;

        ctx.globalAlpha = .4;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, 200, canvas.height);

        ctx.globalAlpha = 1;
        ctx.fillStyle = "#FFF";
        ctx.font = "30px Ubuntu";
        ctx.fillText("Leaderboard", 100 - ctx.measureText("Leaderboard").width / 2, 40);

        if (leaderboard.type === "pie") {
            var last = 0;
            for (var i = 0; i < len; i++) {
                ctx.fillStyle = leaderboard.teams[i];
                ctx.beginPath();
                ctx.moveTo(100, 140);
                ctx.arc(100, 140, 80, last, (last += leaderboard.items[i] * PI_2), false);
                ctx.closePath();
                ctx.fill();
            }
        } else {
            var text, isMe = false, w, start;
            ctx.font = "20px Ubuntu";
            for (var i = 0; i < len; i++) {
                if (leaderboard.type === "text")
                    text = leaderboard.items[i];
                else
                    text = leaderboard.items[i].name,
                    isMe = leaderboard.items[i].me;

                // replace {skin} with empty string
                var reg = /\{([\w]+)\}/.exec(text);
                if (reg) text = text.replace(reg[0], "").trim();

                ctx.fillStyle = isMe ? "#FAA" : "#FFF";
                if (leaderboard.type === "ffa")
                    text = (i + 1) + ". " + (text || "An unnamed cell");
                var start = ((w = ctx.measureText(text).width) > 200) ? 2 : 100 - w * 0.5;
                ctx.fillText(text, start, 70 + 24 * i);
            }
        }
    }
    function drawGrid() {
        mainCtx.save();
        mainCtx.lineWidth = 1;
        mainCtx.strokeStyle = settings.darkTheme ? "#AAA" : "#000";
        mainCtx.globalAlpha = 0.2;
        var step = 50,
            i,
            cW = mainCanvas.width / cameraZ, cH = mainCanvas.height / cameraZ,
            startLeft = (-cameraX + cW / 2) % step,
            startTop = (-cameraY + cH / 2) % step;

        scaleForth(mainCtx);
        mainCtx.beginPath();
        for (i = startLeft; i < cW; i += step) {
            mainCtx.moveTo(i, 0);
            mainCtx.lineTo(i, cH);
        }
        for (i = startTop; i < cH; i += step) {
            mainCtx.moveTo(0, i);
            mainCtx.lineTo(cW, i);
        }
        mainCtx.closePath();
        mainCtx.stroke();
        mainCtx.restore();
    }
    function drawMinimap() {
        if (border.centerX !== 0 || border.centerY !== 0 || !settings.showMinimap) return;
        mainCtx.save();
        var targetSize = 200;
        var width = targetSize * (border.width / border.height);
        var height = targetSize * (border.height / border.width);
        var beginX = mainCanvas.width / viewMult - width;
        var beginY = mainCanvas.height / viewMult - height;

        mainCtx.fillStyle = "#000";
        mainCtx.globalAlpha = 0.4;
        mainCtx.fillRect(beginX, beginY, width, height);
        mainCtx.globalAlpha = 1;

        var sectorCount = 5;
        var sectorNames = ["ABCDE", "12345"];
        var sectorWidth = width / sectorCount;
        var sectorHeight = height / sectorCount;
        var sectorNameSize = Math.min(sectorWidth, sectorHeight) / 3;

        mainCtx.fillStyle = settings.darkTheme ? "#666" : "#DDD";
        mainCtx.textBaseline = "middle";
        mainCtx.textAlign = "center";
        mainCtx.font = `${sectorNameSize}px Ubuntu`;

        for (var i = 0; i < sectorCount; i++) {
            var x = sectorWidth / 2 + i * sectorWidth;
            for (var j = 0; j < sectorCount; j++) {
                var y = sectorHeight / 2 + j * sectorHeight;
                mainCtx.fillText(`${sectorNames[0][i]}${sectorNames[1][j]}`, beginX + x, beginY + y);
            }
        }

        var xScaler = width / border.width;
        var yScaler = height / border.height;
        var halfWidth = border.width / 2;
        var halfHeight = border.height / 2;
        var myPosX = beginX + (cameraX + halfWidth) * xScaler;
        var myPosY = beginY + (cameraY + halfHeight) * yScaler;
        mainCtx.beginPath();
        if (cells.mine.length) {
            for (var i = 0; i < cells.mine.length; i++) {
                var cell = cells.byId[cells.mine[i]];
                if (cell) {
                    mainCtx.fillStyle = cell.color; // repeat assignment of same color is OK
                    var x = beginX + (cell.x + halfWidth) * xScaler;
                    var y = beginY + (cell.y + halfHeight) * yScaler;
                    var r = cell.s * xScaler; // if map is square, both scalers should be the same
                    mainCtx.moveTo(x + r, y);
                    mainCtx.arc(x, y, r, 0, PI_2);
                }
            }
        } else {
            mainCtx.fillStyle = "#FAA";
            mainCtx.arc(myPosX, myPosY, 5, 0, PI_2);
        }
        mainCtx.fill();

        // draw name above user's pos if they have a cell on the screen
        var cell = null;
        for (var i = 0, l = cells.mine.length; i < l; i++)
            if (cells.byId.hasOwnProperty(cells.mine[i])) {
                cell = cells.byId[cells.mine[i]];
                break;
            }
        if (cell !== null) {
            mainCtx.fillStyle = settings.darkTheme ? "#DDD" : "#222";
            var textSize = sectorNameSize;
            mainCtx.font = `${textSize}px Ubuntu`;
            mainCtx.fillText(cell.name, myPosX, myPosY - 7 - textSize / 2);
        }

        mainCtx.restore();
    }

    function drawBorders() {
        if(!settings.showBorder) return;
        mainCtx.strokeStyle = '#0000ff';
        mainCtx.lineWidth = 20;
        mainCtx.lineCap = "round";
        mainCtx.lineJoin = "round";
        mainCtx.beginPath();
        mainCtx.moveTo(border.left, border.top);
        mainCtx.lineTo(border.right, border.top);
        mainCtx.lineTo(border.right, border.bottom);
        mainCtx.lineTo(border.left, border.bottom);
        mainCtx.closePath();
        mainCtx.stroke();
    };

    function drawGame() {
        stats.framesPerSecond += (1000 / Math.max(Date.now() - syncAppStamp, 1) - stats.framesPerSecond) / 10;
        syncAppStamp = Date.now();

        var drawList = cells.list.slice(0).sort(cellSort);
        for (var i = 0, l = drawList.length; i < l; i++)
            drawList[i].update(syncAppStamp);
        cameraUpdate();

        mainCtx.save();

        mainCtx.fillStyle = settings.darkTheme ? "#111" : "#F2FBFF";
        mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
        if (settings.showGrid) drawGrid();

        toCamera(mainCtx);
        drawBorders();

        for (var i = 0, l = drawList.length; i < l; i++)
            drawList[i].draw(mainCtx);

        fromCamera(mainCtx);
        mainCtx.scale(viewMult, viewMult);

        var height = 2;
        mainCtx.fillStyle = settings.darkTheme ? "#FFF" : "#000";
        mainCtx.textBaseline = "top";
        if (!isNaN(stats.score)) {
            mainCtx.font = "30px Ubuntu";
            mainCtx.fillText(`Score: ${stats.score}`, 2, height);
            height += 30;
        }
        mainCtx.font = "20px Ubuntu";
        var gameStatsText = `${~~stats.framesPerSecond} FPS`;
        if (!isNaN(stats.latency)) gameStatsText += ` ${stats.latency}ms ping`;
        mainCtx.fillText(gameStatsText, 2, height);
        height += 24;

        if (stats.visible)
            mainCtx.drawImage(stats.canvas, 2, height);
        if (leaderboard.visible)
            mainCtx.drawImage(
                leaderboard.canvas,
                mainCanvas.width / viewMult - 10 - leaderboard.canvas.width,
                10);
        if (settings.showChat && (chat.visible || isTyping)) {
            mainCtx.globalAlpha = isTyping ? 1 : Math.max(1000 - syncAppStamp + chat.waitUntil, 0) / 1000;
            mainCtx.drawImage(
                chat.canvas,
                10 / viewMult,
                (mainCanvas.height - 55) / viewMult - chat.canvas.height
            );
            mainCtx.globalAlpha = 1;
        }
        drawMinimap();
        drawPosition();

        mainCtx.restore();

        if (minionControlled) {
            mainCtx.save();
            mainCtx.font = "12px Ubuntu";
            mainCtx.textAlign = "center";
            mainCtx.textBaseline = "hanging";
            mainCtx.fillStyle = "#eea236";
            var text = "You are controlling a minion, press Q to switch back.";
            mainCtx.fillText(text, mainCanvas.width / 2, 5);
            mainCtx.restore();
        }

        cacheCleanup();
        window.requestAnimationFrame(drawGame);
    }

    function cellSort(a, b) {
        return a.s === b.s ? a.id - b.id : a.s - b.s;
    }

    function cameraUpdate() {
        var myCells = [];
        for (var i = 0; i < cells.mine.length; i++)
            if (cells.byId.hasOwnProperty(cells.mine[i]))
                myCells.push(cells.byId[cells.mine[i]]);
        if (myCells.length > 0) {
            var x = 0,
                y = 0,
                s = 0,
                score = 0;
            for (var i = 0, l = myCells.length; i < l; i++) {
                var cell = myCells[i];
                score += ~~(cell.ns * cell.ns / 100);
                x += cell.x;
                y += cell.y;
                s += cell.s;
            }
            targetX = x / l;
            targetY = y / l;
            targetZ = Math.pow(Math.min(64 / s, 1), .4);
            cameraX += (targetX - cameraX) / 2;
            cameraY += (targetY - cameraY) / 2;
            stats.score = score;
            stats.maxScore = Math.max(stats.maxScore, score);
        } else {
            stats.score = NaN;
            stats.maxScore = 0;
            cameraX += (targetX - cameraX) / 20;
            cameraY += (targetY - cameraY) / 20;
        }
        cameraZ += (targetZ * viewMult * mouseZ - cameraZ) / 9;
        cameraZInvd = 1 / cameraZ;
    }

    function Cell(id, x, y, s, name, color, skin, flags) {
        this.id = id;
        this.x = this.nx = this.ox = x;
        this.y = this.ny = this.oy = y;
        this.s = this.ns = this.os = s;
        this.setColor(color);
        this.setName(name);
        this.setSkin(skin);
        this.jagged = flags & 0x01 || flags & 0x10;
        this.ejected = !!(flags & 0x20);
        this.born = syncUpdStamp;
    }
    Cell.prototype = {
        destroyed: false,
        id: 0, diedBy: 0,
        ox: 0, x: 0, nx: 0,
        oy: 0, y: 0, ny: 0,
        os: 0, s: 0, ns: 0,
        nameSize: 0, drawNameSize: 0,
        color: "#FFF", sColor: "#E5E5E5",
        skin: null, jagged: false,
        born: null, updated: null, dead: null, // timestamps
        destroy: function(killerId) {
            delete cells.byId[this.id];
            if (cells.mine.remove(this.id) && cells.mine.length === 0)
                showESCOverlay();
            this.destroyed = true;
            this.dead = syncUpdStamp;
            if (killerId && !this.diedBy) {
                this.diedBy = killerId;
                this.updated = syncUpdStamp;
            }
        },
        update: function(relativeTime) {
            var dt = (relativeTime - this.updated) / 120;
            dt = Math.max(Math.min(dt, 1), 0);
            if (this.destroyed && Date.now() > this.dead + 200)
                cells.list.remove(this);
            else if (this.diedBy && cells.byId.hasOwnProperty(this.diedBy)) {
                this.nx = cells.byId[this.diedBy].x;
                this.ny = cells.byId[this.diedBy].y;
            }
            var dt2 = this.diedBy ? dt * dt : dt;
            this.x = this.ox + (this.nx - this.ox) * dt2;
            this.y = this.oy + (this.ny - this.oy) * dt2;
            this.s = this.os + (this.ns - this.os) * dt;
            this.nameSize = ~~(~~(Math.max(~~(0.3 * this.ns), 24)) / 3) * 3;
            this.drawNameSize = ~~(~~(Math.max(~~(0.3 * this.s), 24)) / 3) * 3;
        },
        setName: function(value) {
            var nameSkin = /\{([\w\W]+)\}/.exec(value);
            if (this.skin === null && nameSkin !== null) {
                this.name = value.replace(nameSkin[0], "").trim();
                this.setSkin(nameSkin[1]);
            } else this.name = value;
        },
        setSkin: function(value) {
            this.skin = (value && value[0] === "%" ? value.slice(1) : value) || this.skin;
            if (this.skin === null || !knownSkins.hasOwnProperty(this.skin) || loadedSkins[this.skin])
                return;
            loadedSkins[this.skin] = new Image();
            loadedSkins[this.skin].src = `${SKIN_URL}${this.skin}.png`;
        },
        setColor: function(value) {
            if (!value) { log.warn("got no color"); return; }
            this.color = value;
            this.sColor = darkenColor(value);
        },
        draw: function(ctx) {
            ctx.save();
            this.drawShape(ctx);
            this.drawText(ctx);
            ctx.restore();
        },
        drawShape: function(ctx) {
            ctx.fillStyle = settings.showColor ? this.color : Cell.prototype.color;
            ctx.strokeStyle = settings.showColor ? this.sColor : Cell.prototype.sColor;
            ctx.lineWidth = Math.max(~~(this.s / 50), 10);
            if (!this.ejected && 20 < this.s)
                this.s -= ctx.lineWidth / 2 - 2;

            ctx.beginPath();
            if (this.jagged) {
                ctx.lineJoin = "miter";
                var pointCount = 120;
                var incremental = PI_2 / pointCount;
                ctx.moveTo(this.x, this.y + this.s + 3);
                for (var i = 1; i < pointCount; i++) {
                    var angle = i * incremental;
                    var dist = this.s - 3 + (i % 2 === 0) * 6;
                    ctx.lineTo(
                        this.x + dist * Math.sin(angle),
                        this.y + dist * Math.cos(angle)
                    )
                }
                ctx.lineTo(this.x, this.y + this.s + 3);
            } else ctx.arc(this.x, this.y, this.s, 0, PI_2, false);
            ctx.closePath();

            if (this.destroyed)
                ctx.globalAlpha = Math.max(120 - Date.now() + this.dead, 0) / 120;
            else ctx.globalAlpha = Math.min(Date.now() - this.born, 120) / 120;

            if (!this.ejected && 20 < this.s)
                ctx.stroke();
            ctx.fill();
            if (settings.showSkins && this.skin) {
                var skin = loadedSkins[this.skin];
                if (skin && skin.complete && skin.width && skin.height) {
                    ctx.save();
                    ctx.clip();
                    scaleBack(ctx);
                    var sScaled = this.s * cameraZ;
                    ctx.drawImage(skin,
                        this.x * cameraZ - sScaled,
                        this.y * cameraZ - sScaled,
                        sScaled *= 2, sScaled);
                    scaleForth(ctx);
                    ctx.restore();
                }
            }
            if (!this.ejected && 20 < this.s)
                this.s += ctx.lineWidth / 2 - 2;
        },
        drawText: function(ctx) {
            if (this.s < 20 || this.jagged) return;
            if (settings.showMass && (cells.mine.indexOf(this.id) !== -1 || cells.mine.length === 0)) {
                var mass = (~~(this.s * this.s / 100)).toString();
                if (this.name && settings.showNames) {
                    drawText(ctx, false, this.x, this.y, this.nameSize, this.drawNameSize, this.name);
                    var y = this.y + Math.max(this.s / 4.5, this.nameSize / 1.5);
                    drawText(ctx, true, this.x, y, this.nameSize / 2, this.drawNameSize / 2, mass);
                } else drawText(ctx, true, this.x, this.y, this.nameSize / 2, this.drawNameSize / 2, mass);
            } else if (this.name && settings.showNames)
                drawText(ctx, false, this.x, this.y, this.nameSize, this.drawNameSize, this.name);
        }
    };

    function cacheCleanup() {
        for (var i in cachedNames) {
            for (var j in cachedNames[i])
                if (syncAppStamp - cachedNames[i][j].accessTime >= 5000)
                    delete cachedNames[i][j];
            if (cachedNames[i] === { }) delete cachedNames[i];
        }
        for (var i in cachedMass)
            if (syncAppStamp - cachedMass[i].accessTime >= 5000)
                delete cachedMass[i];
    }

    // 2-var draw-stay cache
    var cachedNames = { };
    var cachedMass  = { };

    function drawTextOnto(canvas, ctx, text, size) {
        ctx.font = `${size}px Ubuntu`;
        ctx.lineWidth = settings.showTextOutline ? Math.max(~~(size / 10), 2) : 0;
        canvas.width = ctx.measureText(text).width + 2 * ctx.lineWidth;
        canvas.height = 4 * size;
        ctx.font = `${size}px Ubuntu`;
        ctx.lineWidth = settings.showTextOutline ? Math.max(~~(size / 10), 2) : 0;
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.fillStyle = "#FFF"
        ctx.strokeStyle = "#000";
        ctx.translate(canvas.width / 2, 2 * size);
        (ctx.lineWidth !== 1) && ctx.strokeText(text, 0, 0);
        ctx.fillText(text, 0, 0);
    }
    function drawRaw(ctx, x, y, text, size) {
        ctx.font = `${size}px Ubuntu`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.lineWidth = settings.showTextOutline ? Math.max(~~(size / 10), 2) : 0;
        ctx.fillStyle = "#FFF"
        ctx.strokeStyle = "#000";
        (ctx.lineWidth !== 1) && ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
        ctx.restore();
    }
    function newNameCache(value, size) {
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        drawTextOnto(canvas, ctx, value, size);

        cachedNames[value] = cachedNames[value] || { };
        cachedNames[value][size] = {
            width: canvas.width,
            height: canvas.height,
            canvas: canvas,
            value: value,
            size: size,
            accessTime: syncAppStamp
        };
        return cachedNames[value][size];
    }
    function newMassCache(size) {
        var canvases = {
            "0": { }, "1": { }, "2": { }, "3": { }, "4": { },
            "5": { }, "6": { }, "7": { }, "8": { }, "9": { }
        };
        for (var value in canvases) {
            var canvas = canvases[value].canvas = document.createElement("canvas");
            var ctx = canvas.getContext("2d");
            drawTextOnto(canvas, ctx, value, size);
            canvases[value].canvas = canvas;
            canvases[value].width = canvas.width;
            canvases[value].height = canvas.height;
        }
        cachedMass[size] = {
            canvases: canvases,
            size: size,
            lineWidth: settings.showTextOutline ? Math.max(~~(size / 10), 2) : 0,
            accessTime: syncAppStamp
        };
        return cachedMass[size];
    }
    function toleranceTest(a, b, tolerance) {
        return (a - tolerance) <= b && b <= (a + tolerance);
    }
    function getNameCache(value, size) {
        if (!cachedNames[value]) return newNameCache(value, size);
        var sizes = Object.keys(cachedNames[value]);
        for (var i = 0, l = sizes.length; i < l; i++)
            if (toleranceTest(size, sizes[i], size / 4))
                return cachedNames[value][sizes[i]];
        return newNameCache(value, size);
    }
    function getMassCache(size) {
        var sizes = Object.keys(cachedMass);
        for (var i = 0, l = sizes.length; i < l; i++)
            if (toleranceTest(size, sizes[i], size / 4))
                return cachedMass[sizes[i]];
        return newMassCache(size);
    }

    function drawText(ctx, isMass, x, y, size, drawSize, value) {
        ctx.save();
        if (size > 500) return drawRaw(ctx, x, y, value, drawSize);
        ctx.imageSmoothingQuality = "high";
        if (isMass) {
            var cache = getMassCache(size);
            cache.accessTime = syncAppStamp;
            var canvases = cache.canvases;
            var correctionScale = drawSize / cache.size;

            // calculate width
            var width = 0;
            for (var i = 0; i < value.length; i++)
                width += canvases[value[i]].width - 2 * cache.lineWidth;

            ctx.scale(correctionScale, correctionScale);
            x /= correctionScale;
            y /= correctionScale;
            x -= width / 2;
            for (var i = 0; i < value.length; i++) {
                var item = canvases[value[i]];
                ctx.drawImage(item.canvas, x, y - item.height / 2);
                x += item.width - 2 * cache.lineWidth;
            }
        } else {
            var cache = getNameCache(value, size);
            cache.accessTime = syncAppStamp;
            var canvas = cache.canvas;
            var correctionScale = drawSize / cache.size;
            ctx.scale(correctionScale, correctionScale);
            x /= correctionScale;
            y /= correctionScale;
            ctx.drawImage(canvas, x - canvas.width / 2, y - canvas.height / 2);
        }
        ctx.restore();
    }
    function keydown(event) {
        var key = event.key.toLowerCase();
        if (key == "enter") {
            if (escOverlayShown || !settings.showChat) return;
            if (isTyping) {
                chatBox.blur();
                var text = chatBox.value;
                if (text.length > 0) sendChat(text);
                chatBox.value = "";
            } else chatBox.focus();
        } else if (pressed[key]) {
            return;
        } else if (key == "escape") {
            pressed[key] = true;
            escOverlayShown ? hideESCOverlay() : showESCOverlay();
        } else {
            if (isTyping || escOverlayShown) return;
            if (pressed.hasOwnProperty(key)) pressed[key] = true;
            var code = KEY_TO_CODE[key];
            if (code !== undefined) wsSend(code);
            if (key == "w") macroIntervalID = setInterval(function() {
                wsSend(code);
            }, macroCooldown);
            if (key == "q") minionControlled = !minionControlled;
        }
    }
    function keyup(event) {
        var key = event.key.toLowerCase();
        if (pressed.hasOwnProperty(key)) pressed[key] = false;
        if (key == "q") wsSend(UINT8_CACHE[19]);
        if (key == "w") clearInterval(macroIntervalID);
    }
    function handleScroll(event) {
        if (event.target !== mainCanvas) return;
        mouseZ *= event.deltaY > 0 ? 0.8 : 1.2;
        mouseZ = Math.max(mouseZ, settings.moreZoom ? 0.1 : 1);
        mouseZ = Math.min(mouseZ, 4);
    }

    function init() {
        mainCanvas = document.getElementById("canvas");
        mainCtx = mainCanvas.getContext("2d");
        chatBox = byId("chat_textbox");
        soundsVolume = byId("soundsVolume");
        mainCanvas.focus();

        loadSettings();
        window.addEventListener("beforeunload", storeSettings);
        document.addEventListener("wheel", handleScroll, {passive: true});
        byId("play-btn").addEventListener("click", function() {
            if (settings.skin) {
                sendPlay("{" + settings.skin + "}" + settings.nick);
            } else {
                sendPlay(settings.nick);
            }
            hideESCOverlay();
        });
        window.onkeydown = keydown;
        window.onkeyup = keyup;
        chatBox.onblur = function() {
            isTyping = false;
            drawChat();
        };
        chatBox.onfocus = function() {
            isTyping = true;
            drawChat();
        };
        mainCanvas.onmousemove = function(event) {
            mouseX = event.clientX;
            mouseY = event.clientY;
        };
        setInterval(function() {
            sendMouseMove(
                (mouseX - mainCanvas.width / 2) / cameraZ + cameraX,
                (mouseY - mainCanvas.height / 2) / cameraZ + cameraY
            );
        }, 40);
        window.onresize = function() {
            var cW = mainCanvas.width = window.innerWidth,
                cH = mainCanvas.height = window.innerHeight;
            viewMult = Math.sqrt(Math.min(cH / 1080, cW / 1920));
        };
        window.onresize();
        var mobileStuff = byId("mobileStuff");
        var touchpad = byId("touchpad");
        var touchCircle = byId("touchCircle");
        var touchSize = .2;
        var touched = false;
        var touchmove = function(event) {
            var touch = event.touches[0];
            var width = innerWidth * touchSize;
            var height = innerHeight * touchSize;
            if (touch.pageX < width && touch.pageY > innerHeight - height) {
                mouseX = innerWidth / 2 + (touch.pageX - width / 2) * innerWidth / width;
                mouseY = innerHeight / 2 + (touch.pageY - (innerHeight - height / 2)) * innerHeight / height;
            } else {
                mouseX = touch.pageX;
                mouseY = touch.pageY;
            }
            var r = innerWidth * .02;
            touchCircle.style.left = mouseX - r + "px";
            touchCircle.style.top = mouseY - r + "px";
        };
        window.addEventListener("touchmove", touchmove);
        window.addEventListener("touchstart", function(event) {
            if (!touched) {
                touched = true;
                mobileStuff.show();
            }
            if (event.target.id == "splitBtn") {
                wsSend(UINT8_CACHE[17]);
            } else if (event.target.id == "ejectBtn") {
                wsSend(UINT8_CACHE[21]);
            } else {
                touchmove(event);
            }
            touchCircle.show();
        });
        window.addEventListener("touchend", function(event) {
            if (event.touches.length === 0) {
                touchCircle.hide();
            }
        });

        gameReset();
        showESCOverlay();

        if (window.location.search) {
            var div = /ip=([\w\W]+):([0-9]+)/.exec(window.location.search.slice(1))
            if (div) wsInit(div[1] + ":" + div[2]);
        }
        window.setserver(byId("gamemode").value);
        window.requestAnimationFrame(drawGame);
        log.info(`init done in ${Date.now() - LOAD_START}ms`);
    }
    window.setserver = function(arg) {
        if (wsUrl === arg) return;
        wsInit(arg);
    };
    window.spectate = function(a) {
        wsSend(UINT8_CACHE[1]);
        stats.maxScore = 0;
        hideESCOverlay();
    };
    window.changeSkin = function(a) {
        byId("skin").value = a;
        settings.skin = a;
        byId("gallery").hide();
    };
    window.openSkinsList = function() {
        buildGallery();
        byId("skinsUL").style.height = window.innerHeight * 0.75 + "px";
        byId("gallery").show(0.5);
    };
    window.addEventListener("DOMContentLoaded", init);
})();
