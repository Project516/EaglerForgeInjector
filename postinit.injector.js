globalThis.modapi_postinit = `(() => {
    //EaglerForge post initialization code.
    //This script cannot contain backticks, escape characters, or backslashes in order to inject into the dedicated server code.
    var startedModLoader = false;

    function startModLoader() {
        if (!startedModLoader) {
            startedModLoader = true;
            modLoader([]);
        }
    }

    ModAPI.hooks._classMap = {};
    globalThis.PluginAPI ||= ModAPI;
    ModAPI.mcinstance ||= {};
    ModAPI.javaClient ||= {};
    ModAPI.server = ModAPI.serverInstance = null;
    ModAPI.dedicatedServer ||= {};
    ModAPI.dedicatedServer._data ||= [];
    ModAPI.dedicatedServer._wasUsed = false;
    ModAPI.dedicatedServer.appendCode = function (code) {
        if (ModAPI.dedicatedServer._wasUsed) {
            return console.warn("The dedicated server has already launched, ModAPI.dedicatedServer.appendCode() is useless.");
        }
        if (typeof code === "function") {
            ModAPI.dedicatedServer._data.push("(" + code.toString() + ")()");
        } else if (typeof code === "string") {
            ModAPI.dedicatedServer._data.push(code);
        }
    }
    ModAPI.util ||= {};
    ModAPI.util.getMethodFromPackage = function (classId, methodName) {
        var name = "";
        var classStuff = classId.split(".");
        classStuff.forEach((component, i) => {
            if (i === classStuff.length - 1) {
                name += "_" + component;
            } else {
                name += component[0].toLowerCase();
            }
        });
        name += "_" + methodName;
        return name;
    }
    ModAPI.util.getCompiledNameFromPackage = ModAPI.util.getCompiledName = function (classId) {
        var name = "";
        var classStuff = classId.split(".");
        classStuff.forEach((component, i) => {
            if (i === classStuff.length - 1) {
                name += "_" + component;
            } else {
                name += component[0].toLowerCase();
            }
        });
        return name;
    }
    ModAPI.version = "v2.0";
    ModAPI.flavour = "injector";
    ModAPI.GNU = "terry pratchett";
    ModAPI.credits = ["ZXMushroom63", "radmanplays", "OtterCodes101", "TheIdiotPlays"];
    ModAPI.hooks.regenerateClassMap = function () {
        ModAPI.hooks._rippedConstructorKeys = Object.keys(ModAPI.hooks._rippedConstructors);
        ModAPI.hooks._rippedMethodKeys = Object.keys(ModAPI.hooks._rippedMethodTypeMap);

        var compiledNames = new Set();
        var metaMap = {};

        //Loop through ripped metadata passes. Classes obtained through this method have full metadata (superclasses, full names, binary names, actual class)
        ModAPI.hooks._rippedData.forEach(block => {
            block.forEach(item => {
                if (typeof item === "function") {
                    if (!item.$meta || typeof item.$meta.name !== "string") {
                        return;
                    }
                    var compiledName = ModAPI.util.getCompiledNameFromPackage(item.$meta.name);
                    compiledNames.add(compiledName);
                    metaMap[compiledName] = item;
                }
            });
        });

        ModAPI.hooks._rippedConstructorKeys.forEach(constructor => {
            if (typeof constructor === "string" && constructor.length > 0) {
                //Constructor names are phrased as aaa_Apple__init_3 or similar, the separator is __init_
                var constructorData = constructor.split("__init_");
                if (constructorData[0] && constructorData[0].includes("_")) {
                    compiledNames.add(constructorData[0]);
                }
            }
        });


        //Initialise all compiled names into the class map
        compiledNames.forEach(compiledName => {
            var item = metaMap[compiledName];
            var classId = item?.$meta?.name || null;

            if (!ModAPI.hooks._classMap[compiledName]) {
                ModAPI.hooks._classMap[compiledName] = {
                    "name": compiledName.split("_")[1],
                    "id": classId,
                    "binaryName": item?.$meta?.binaryName || null,
                    "constructors": [],
                    "methods": {},
                    "staticMethods": {},
                    "staticVariables": {},
                    "staticVariableNames": [],
                    "class": item || null,
                    "hasMeta": !!item,
                    "compiledName": compiledName
                }
            }
            if (typeof item?.$meta?.superclass === "function" && item?.$meta?.superclass?.$meta) {
                ModAPI.hooks._classMap[compiledName].superclass = item.$meta.superclass.$meta.name;
            } else {
                ModAPI.hooks._classMap[compiledName].superclass = null;
            }
            ModAPI.hooks._classMap[compiledName].staticVariableNames = ModAPI.hooks._rippedStaticIndexer[compiledName];
            ModAPI.hooks._classMap[compiledName].staticVariables = ModAPI.hooks._rippedStaticProperties[compiledName];
            if (item?.["$$constructor$$"]) {
                //Class does not have any hand written constructors
                //Eg: class MyClass {}
                ModAPI.hooks._classMap[compiledName].constructors.push(item["$$constructor$$"]);
            } else {
                //Class has hand written constructors, we need to search in the stash
                ModAPI.hooks._rippedConstructorKeys.forEach(constructor => {
                    if (constructor.startsWith(compiledName + "__init_") && !constructor.includes("$lambda$")) {
                        ModAPI.hooks._classMap[compiledName].constructors.push(ModAPI.hooks._rippedConstructors[constructor]);
                    }
                });
            }
            ModAPI.hooks._rippedMethodKeys.forEach((method) => {
                if (method.startsWith(compiledName + "_") && !method.includes("$lambda$")) {
                    var targetMethodMap = ModAPI.hooks._classMap[compiledName].methods;
                    if (ModAPI.hooks._rippedMethodTypeMap[method] === "static") {
                        targetMethodMap = ModAPI.hooks._classMap[compiledName].staticMethods;
                    }
                    targetMethodMap[method.replace(compiledName + "_", "")] = {
                        method: ModAPI.hooks.methods[method],
                        proxiedMethod: function (...args) {
                            return ModAPI.hooks.methods[method].apply(this, args);
                        },
                        methodName: method
                    };
                }
            });
        });
        console.log("[ModAPI] Regenerated hook classmap.");
    }
    ModAPI.hooks.regenerateClassMap();
    var reloadDeprecationWarnings = 0;
    const TeaVM_to_BaseData_ProxyConf = {
        get(target, prop, receiver) {
            if (prop === "getRef") {
                return function () {
                    return target;
                }
            }
            if (prop === "reload") {
                return function () {
                    if (reloadDeprecationWarnings < 10) {
                        console.warn("ModAPI/PluginAPI reload() is obsolete, please stop using it in code.")
                        reloadDeprecationWarnings++;
                    }
                }
            }

            var outProp = "$" + prop;
            var outputValue = Reflect.get(target, outProp, receiver);
            if (outputValue && typeof outputValue === "object" && Array.isArray(outputValue.data) && typeof outputValue.type === "function") {
                return outputValue.data;
            }
            if (outputValue && typeof outputValue === "function") {
                return function (...args) {
                    return outputValue.apply(target, args);
                }
            }
            return outputValue;
        },
        set(object, prop, value) {
            var outProp = "$" + prop;
            object[outProp] = value;
            return true;
        },
    };
    const TeaVMArray_To_Recursive_BaseData_ProxyConf = {
        get(target, prop, receiver) {
            var outputValue = Reflect.get(target, prop, receiver);
            if (outputValue && typeof outputValue === "object" && !Array.isArray(outputValue)) {
                return new Proxy(outputValue, TeaVM_to_Recursive_BaseData_ProxyConf);
            }
            if (prop === "getRef") {
                return function () {
                    return target;
                }
            }
            return outputValue;
        },
        set(object, prop, value) {
            object[prop] = value;
            return true;
        }
    }
    const TeaVM_to_Recursive_BaseData_ProxyConf = {
        get(target, prop, receiver) {
            if (prop === "getRef") {
                return function () {
                    return target;
                }
            }
            if (prop === "reload") {
                return function () {
                    if (reloadDeprecationWarnings < 10) {
                        console.warn("ModAPI/PluginAPI reload() is obsolete, please stop using it in code.")
                        reloadDeprecationWarnings++;
                    }
                }
            }

            var outProp = "$" + prop;
            var outputValue = Reflect.get(target, outProp, receiver);
            if (outputValue && typeof outputValue === "object" && Array.isArray(outputValue.data) && typeof outputValue.type === "function") {
                return new Proxy(outputValue.data, TeaVMArray_To_Recursive_BaseData_ProxyConf);
            }
            if (outputValue && typeof outputValue === "object" && !Array.isArray(outputValue)) {
                return new Proxy(outputValue, TeaVM_to_Recursive_BaseData_ProxyConf);
            }
            if (outputValue && typeof outputValue === "function") {
                return function (...args) {
                    return outputValue.apply(target, args);
                }
            }
            return outputValue;
        },
        set(object, prop, value) {
            var outProp = "$" + prop;
            object[outProp] = value;
            return true;
        },
    };
    const StaticProps_ProxyConf = {
        get(target, prop, receiver) {
            var outProp = prop;
            var outputValue = Reflect.get(target, outProp, receiver);
            if (outputValue && typeof outputValue === "object" && Array.isArray(outputValue.data) && typeof outputValue.type === "function") {
                return new Proxy(outputValue.data, TeaVMArray_To_Recursive_BaseData_ProxyConf);
            }
            if (outputValue && typeof outputValue === "object" && !Array.isArray(outputValue)) {
                return new Proxy(outputValue, TeaVM_to_Recursive_BaseData_ProxyConf);
            }
            return outputValue;
        },
        set(object, prop, value) {
            var outProp = prop;
            object[outProp] = value;
            return true;
        },
    };
    ModAPI.util.TeaVM_to_BaseData_ProxyConf = TeaVM_to_BaseData_ProxyConf;
    ModAPI.util.TeaVMArray_To_Recursive_BaseData_ProxyConf = TeaVMArray_To_Recursive_BaseData_ProxyConf;
    ModAPI.util.TeaVM_to_Recursive_BaseData_ProxyConf = TeaVM_to_Recursive_BaseData_ProxyConf;
    ModAPI.util.StaticProps_ProxyConf = StaticProps_ProxyConf;
    ModAPI.required = new Set();
    ModAPI.events = {};
    ModAPI.events.types = ["event"];
    ModAPI.events.listeners = { "event": [] };
    ModAPI.addEventListener = function addEventListener(name, callback) {
        if (!callback || typeof callback !== "function") {
            throw new Error("[ModAPI] Invalid callback!");
        }
        if (ModAPI.events.types.includes(name)) {
            if (!Array.isArray(ModAPI.events.listeners[name])) {
                ModAPI.events.listeners[name] = [];
            }
            ModAPI.events.listeners[name].push(callback);
            console.log("[ModAPI] Added new event listener.");
        } else {
            throw new Error("[ModAPI] This event does not exist!");
        }
    };

    ModAPI.removeEventListener = function removeEventListener(name, func, slow) {
        if (!func) {
            throw new Error("Invalid callback!");
        }
        if (!Array.isArray(ModAPI.events.listeners[name])) {
            ModAPI.events.listeners[name] = [];
        }
        var targetArr = ModAPI.events.listeners[name];
        if (!slow) {
            if (targetArr.indexOf(func) !== -1) {
                targetArr.splice(targetArr.indexOf(func), 1);
                console.log("[ModAPI] Removed event listener.");
            }
        } else {
            var functionString = func.toString();
            targetArr.forEach((f, i) => {
                if (f.toString() === functionString) {
                    targetArr.splice(i, 1);
                    console.log("[ModAPI] Removed event listener.");
                }
            });
        }
    };
    ModAPI.events.newEvent = function newEvent(name, side) {
        console.log("[ModAPI] Registered " + side + " event: " + name);
        ModAPI.events.types.push(name);
    };

    ModAPI.events.callEvent = function callEvent(name, data) {
        if (
            !ModAPI.events.types.includes(name) ||
            !Array.isArray(ModAPI.events.listeners[name])
        ) {
            if (!Array.isArray(ModAPI.events.listeners[name])) {
                if (ModAPI.events.types.includes(name)) {
                    ModAPI.events.listeners.event.forEach((func) => {
                        func({ event: name, data: data });
                    });
                    return;
                }
                return;
            }
            console.error(
                "ModAPI/PluginAPI has been called with an invalid event name: " + name
            );
            console.error("Please report this bug to the repo.");
            return;
        }
        ModAPI.events.listeners[name].forEach((func) => {
            func(data);
        });
        ModAPI.events.listeners.event.forEach((func) => {
            func({ event: name, data: data });
        });
    };
    ModAPI.events.newEvent("update", "client");

    ModAPI.require = function (module) {
        ModAPI.required.add(module);
    };
    ModAPI.onUpdate = function () {
        if (ModAPI.required.has("player") && ModAPI.javaClient && ModAPI.javaClient.$thePlayer) {
            ModAPI.player = new Proxy(ModAPI.javaClient.$thePlayer, TeaVM_to_Recursive_BaseData_ProxyConf);
        }
        if (ModAPI.required.has("network") && ModAPI.javaClient && ModAPI.javaClient.$thePlayer && ModAPI.javaClient.$thePlayer.$sendQueue) {
            ModAPI.network = new Proxy(ModAPI.javaClient.$thePlayer.$sendQueue, TeaVM_to_Recursive_BaseData_ProxyConf);
        }
        try {
            ModAPI.events.callEvent("update");
        } catch (error) {
            console.error(error);
        }
    }

    ModAPI.util.stringToUint16Array = function stringToUint16Array(str) {
        const buffer = new ArrayBuffer(str.length * 2); // 2 bytes for each char
        const uint16Array = new Uint16Array(buffer);
        for (let i = 0; i < str.length; i++) {
            uint16Array[i] = str.charCodeAt(i);
        }
        return uint16Array;
    }

    //Overrides $rt_resuming, $rt_suspending, $rt_currentThread. Experimental, but should be used if call stack leaks occur as a result of running internal code.
    ModAPI.freezeCallstack = function () {
        ModAPI.hooks.freezeCallstack = true;
    }
    ModAPI.unfreezeCallstack = function () {
        ModAPI.hooks.freezeCallstack = false;
    }

    ModAPI.util.string = ModAPI.util.str = ModAPI.hooks._teavm.$rt_str;

    ModAPI.util.setStringContent = function (jclString, string) {
        jclString.$characters.data = ModAPI.util.stringToUint16Array(string);
    }

    ModAPI.util.jclStrToJsStr = ModAPI.util.unstr = ModAPI.util.unstring = ModAPI.util.ustr = ModAPI.hooks._teavm.$rt_ustr;

    ModAPI.displayToChat = function (param) {
        var v = typeof param === "object" ? param.msg : (param + "");
        v ||= "";
        var jclString = ModAPI.util.string(v);
        ModAPI.hooks.methods["nmcg_GuiNewChat_printChatMessage"](ModAPI.javaClient.$ingameGUI.$persistantChatGUI, ModAPI.hooks._classMap[ModAPI.util.getCompiledName("net.minecraft.util.ChatComponentText")].constructors[0](jclString));
    }

    const updateMethodName = ModAPI.util.getMethodFromPackage("net.minecraft.client.entity.EntityPlayerSP", "onUpdate");
    const originalUpdate = ModAPI.hooks.methods[updateMethodName];
    ModAPI.hooks.methods[updateMethodName] = function (...args) {
        ModAPI.onUpdate();
        return originalUpdate.apply(this, args);
    };

    const initMethodName = ModAPI.util.getMethodFromPackage("net.minecraft.client.Minecraft", "startGame");
    const originalInit = ModAPI.hooks.methods[initMethodName];
    ModAPI.hooks.methods[initMethodName] = function (...args) {
        var x = originalInit.apply(this, args);
        //args[0] means $this (ie: minecraft instance).
        ModAPI.mcinstance = ModAPI.javaClient = args[0];
        ModAPI.settings = new Proxy(ModAPI.mcinstance.$gameSettings, TeaVM_to_Recursive_BaseData_ProxyConf);

        startModLoader();

        return x;
    };

    ModAPI.events.newEvent("load", "client");

    var integratedServerStartup = ModAPI.util.getMethodFromPackage("net.lax1dude.eaglercraft.v1_8.sp.internal.ClientPlatformSingleplayer", "loadIntegratedServerSourceInline");
    //Integrated server setup has a randomised suffix on the end
    integratedServerStartup = ModAPI.hooks._rippedMethodKeys.filter(key => { return key.startsWith(integratedServerStartup); })[0];
    const integratedServerStartupMethod = ModAPI.hooks.methods[integratedServerStartup];
    ModAPI.hooks.methods[integratedServerStartup] = function (worker, bootstrap) {
        var x = integratedServerStartupMethod.apply(this, [worker, bootstrap + ";" + globalThis.modapi_postinit + ";" + ModAPI.dedicatedServer._data.join(";")]);
        ModAPI.dedicatedServer._data = [];
        ModAPI.dedicatedServer._wasUsed = true;
        return x;
    };

    ModAPI.events.newEvent("sendchatmessage", "client");
    const sendChatMessageMethodName = ModAPI.util.getMethodFromPackage("net.minecraft.client.entity.EntityPlayerSP", "sendChatMessage");
    const sendChatMessage = ModAPI.hooks.methods[sendChatMessageMethodName];
    ModAPI.hooks.methods[sendChatMessageMethodName] = function ($this, $message) {
        var data = {
            preventDefault: false,
            message: ModAPI.util.jclStrToJsStr($message)
        }
        ModAPI.events.callEvent("sendchatmessage", data);
        if (data.preventDefault) {
            return;
        }
        if (typeof data.message === "string") {
            ModAPI.util.setStringContent($message, data.message)
        }
        return sendChatMessage.apply(this, [$this, $message]);
    }

    ModAPI.events.newEvent("tick", "server");
    const serverTickMethodName = ModAPI.util.getMethodFromPackage("net.minecraft.server.MinecraftServer", "tick");
    const serverTickMethod = ModAPI.hooks.methods[serverTickMethodName];
    ModAPI.hooks.methods[serverTickMethodName] = function ($this) {
        var data = { preventDefault: false }
        ModAPI.events.callEvent("tick", data);
        if (data.preventDefault) {
            return;
        }
        return serverTickMethod.apply(this, [$this]);
    }

    ModAPI.events.newEvent("serverstart", "server");
    const serverStartMethodName = ModAPI.util.getMethodFromPackage("net.lax1dude.eaglercraft.v1_8.sp.server.EaglerMinecraftServer", "startServer");
    const serverStartMethod = ModAPI.hooks.methods[serverStartMethodName];
    ModAPI.hooks.methods[serverStartMethodName] = function ($this) {
        var x = serverStartMethod.apply(this, [$this]);
        ModAPI.server = ModAPI.serverInstance = new Proxy($this, ModAPI.util.TeaVM_to_Recursive_BaseData_ProxyConf);
        ModAPI.rawServer = $this;
        ModAPI.events.callEvent("serverstart", {});
        return x;
    }

    ModAPI.events.newEvent("serverstop", "server");
    const serverStopMethodName = ModAPI.util.getMethodFromPackage("net.minecraft.server.MinecraftServer", "stopServer");
    const serverStopMethod = ModAPI.hooks.methods[serverStopMethodName];
    ModAPI.hooks.methods[serverStopMethodName] = function ($this) {
        var x = serverStopMethod.apply(this, [$this]);
        ModAPI.server = ModAPI.serverInstance = null;
        ModAPI.events.callEvent("serverstop", {});
        return x;
    }

    ModAPI.events.newEvent("receivechatmessage", "server");
    const receiveChatMessageMethodName = ModAPI.util.getMethodFromPackage("net.minecraft.network.play.client.C01PacketChatMessage", "processPacket");
    const receiveChatMessageMethod = ModAPI.hooks.methods[receiveChatMessageMethodName];
    ModAPI.hooks.methods[receiveChatMessageMethodName] = function (...args) {
        var $this = args[0];
        var data = {
            preventDefault: false,
            message: ModAPI.util.jclStrToJsStr($this.$message3)
        }
        ModAPI.events.callEvent("sendchatmessage", data);
        if (data.preventDefault) {
            return;
        }
        if (typeof data.message === "string") {
            ModAPI.util.setStringContent($this.$message3, data.message)
        }
        var x = receiveChatMessageMethod.apply(this, args);
        return x;
    }

    ModAPI.events.newEvent("processcommand", "server");
    const processCommandMethodName = ModAPI.util.getMethodFromPackage("net.minecraft.command.CommandHandler", "executeCommand");
    const processCommandMethod = ModAPI.hooks.methods[processCommandMethodName];
    ModAPI.hooks.methods[processCommandMethodName] = function ($this, $sender, $rawCommand) {
        var data = {
            preventDefault: false,
            sender: new Proxy($sender, TeaVM_to_Recursive_BaseData_ProxyConf),
            command: ModAPI.util.jclStrToJsStr($rawCommand)
        }
        ModAPI.events.callEvent("processcommand", data);
        if (data.preventDefault) {
            return;
        }
        if (typeof data.command === "string") {
            ModAPI.util.setStringContent($rawCommand, data.command)
        }
        var x = processCommandMethod.apply(this, [$this, $sender, $rawCommand]);
        return x;
    }

    ModAPI.items = new Proxy(ModAPI.hooks._classMap[ModAPI.util.getCompiledName("net.minecraft.init.Items")].staticVariables, StaticProps_ProxyConf);
    ModAPI.blocks = new Proxy(ModAPI.hooks._classMap[ModAPI.util.getCompiledName("net.minecraft.init.Blocks")].staticVariables, StaticProps_ProxyConf);


    const originalOptionsInit = ModAPI.hooks.methods[ModAPI.util.getMethodFromPackage("net.minecraft.client.gui.GuiOptions", "initGui")];
    ModAPI.hooks.methods[ModAPI.util.getMethodFromPackage("net.minecraft.client.gui.GuiOptions", "initGui")] = function (...args) {
        var x = originalOptionsInit.apply(this, args);

        //NOT A BUG DO NOT FIX
        var msg = Math.random() < 0.05 ? "Plugins" : "Mods";

        // Find the right constructor. (int id, int x, int y, int width, int height, String buttonText);
        var btnConstructor = ModAPI.hooks._classMap['nmcg_GuiButton'].constructors.filter(c => {return c.length === 6})[0];
        var btn = btnConstructor(9635329, 0, args[0].$height8 - 21, 100, 20, ModAPI.util.str(msg));
        args[0].$buttonList.$add(btn);

        return x;
    }

    const originalOptionsAction = ModAPI.hooks.methods[ModAPI.util.getMethodFromPackage("net.minecraft.client.gui.GuiOptions", "actionPerformed")];
    ModAPI.hooks.methods[ModAPI.util.getMethodFromPackage("net.minecraft.client.gui.GuiOptions", "actionPerformed")] = function (...args) {
        if (args[1] && args[1].$id12 === 9635329) {
            if (typeof window.modapi_displayModGui === "function") {
                window.modapi_displayModGui();
            } else {
                alert("[ModAPI] Mod Manager GUI does not exist!")
            }
        }
        var x = originalOptionsAction.apply(this, args);
        return x;
    }
})();`;