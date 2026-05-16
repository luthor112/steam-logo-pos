import { findModule, Millennium, sleep, DialogButton, IconsModule, definePlugin, Field, TextField, Toggle } from "@steambrew/client";
import { createRoot } from "react-dom/client";
import React, { useState, useEffect } from "react";

declare global {
    var MainWindowBrowserManager: any;
    var uiStore: any;
}

const WaitForElement = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))][0];

/*const WaitForElementTimeout = async (sel: string, parent = document, timeOut = 1000) =>
	[...(await Millennium.findElement(parent, sel, timeOut))][0];*/

/*const WaitForElementList = async (sel: string, parent = document) =>
	[...(await Millennium.findElement(parent, sel))];*/

type PluginConfig = {
    context_menu: boolean;
    show_button: boolean;
}

var pluginConfig: PluginConfig = {
    context_menu: false,
    show_button: true
};

type PosDB = Record<string, number[]>;

var posDB: PosDB = {};

function get_app_x(app_id: number) {
    if (app_id.toString() in posDB) {
        return posDB[app_id.toString()][0];
    } else {
        return -1;
    }
}

function get_app_y(app_id: number) {
    if (app_id.toString() in posDB) {
        return posDB[app_id.toString()][1];
    } else {
        return -1;
    }
}

function set_app_xy(app_id: number, pos_x: number, pos_y: number) {
    posDB[app_id.toString()] = [pos_x, pos_y];
    localStorage.setItem("luthor112.steam-logo-pos.posdb", JSON.stringify(posDB));
}

async function OnPopupCreation(popup: any) {
    await sleep(10000);
    if (popup.m_strName === "SP Desktop_uid0") {
        
        let observer: MutationObserver | null = null; // Declare observer here to hold its reference across navigations.

        var mwbm = undefined;
        while (!mwbm) {
            console.log("[steam-logo-pos] Waiting for MainWindowBrowserManager");
            try {
                mwbm = MainWindowBrowserManager;
            } catch {
                await sleep(100);
            }
        }

        MainWindowBrowserManager.m_browser.on("finished-request", async (currentURL: any, previousURL: any) => {
            void currentURL;
            void previousURL;

            if (MainWindowBrowserManager.m_lastLocation.pathname.startsWith("/library/app/")) {
                const sizerDiv = await WaitForElement(`div.${findModule(e => e.BoxSizer).BoxSizer}`, popup.m_popup.document) as HTMLElement;
                const savedX = get_app_x(uiStore.currentGameListSelection.nAppId);
                const savedY = get_app_y(uiStore.currentGameListSelection.nAppId);

                if (savedX !== -1 || savedY !== -1) {
                    sizerDiv.style.left = savedX + "px";
                    sizerDiv.style.top = savedY + "px";
                }

                const movementHandler = async () => {
                    if (!sizerDiv.classList.contains("logopos-header")) {
                        async function makeDraggableElement(elmnt: HTMLElement) {
                            var diffX = 0, diffY = 0, lastX = 0, lastY = 0, elmntX = 0, elmntY = 0;
                            elmnt.onmousedown = dragMouseDown;
                            elmnt.style.cursor = "move";

                            async function dragMouseDown(e: MouseEvent) {
                                //e = e || window.event;
                                e.preventDefault();
                                lastX = e.clientX;
                                lastY = e.clientY;
                                popup.m_popup.document.onmouseup = elementRelease;
                                popup.m_popup.document.onmousemove = elementDrag;
                            }

                            async function elementDrag(e: MouseEvent) {
                                //e = e || window.event;
                                e.preventDefault();
                                diffX = lastX - e.clientX;
                                diffY = lastY - e.clientY;
                                lastX = e.clientX;
                                lastY = e.clientY;
                                elmntY = (elmnt.offsetTop - diffY);
                                elmntX = (elmnt.offsetLeft - diffX);
                                elmnt.style.top = elmntY + "px";
                                elmnt.style.left = elmntX + "px";
                            }

                            async function elementRelease() {
                                popup.m_popup.document.onmouseup = null;
                                popup.m_popup.document.onmousemove = null;
                                set_app_xy(uiStore.currentGameListSelection.nAppId, elmntX, elmntY);
                            }
                        }

                        makeDraggableElement(sizerDiv);
                        sizerDiv.classList.add("logopos-header");

                        const topCapsuleDiv = await WaitForElement(`div.${findModule(e => e.TopCapsule).TopCapsule}`, popup.m_popup.document);
                        const oldDoneBtn = topCapsuleDiv.querySelector("div.logo-move-done-button") as HTMLElement;
                        if (oldDoneBtn) {
                            oldDoneBtn.style.display = "";
                        } else {
                            const doneBtn = document.createElement('div');
                            doneBtn.className = "logo-move-done-button";
                            doneBtn.style.position = "absolute";
                            doneBtn.style.right = "20px";
                            doneBtn.style.bottom = "20px";
                            const doneBtnRoot = createRoot(doneBtn);
                            doneBtnRoot.render(<DialogButton style={{width: "fit-content", padding: "0px 20px"}} onClick={movementHandler}>Done</DialogButton>);
                            topCapsuleDiv.appendChild(doneBtn);
                        }
                    } else {
                        sizerDiv.onmousedown = null;
                        sizerDiv.style.cursor = "";
                        sizerDiv.classList.remove("logopos-header");

                        const topCapsuleDiv = await WaitForElement(`div.${findModule(e => e.TopCapsule).TopCapsule}`, popup.m_popup.document);
                        const oldDoneBtn = topCapsuleDiv.querySelector("div.logo-move-done-button") as HTMLElement;
                        if (oldDoneBtn) {
                            oldDoneBtn.style.display = "none";
                        }
                    }
                };

                const appButtonEnabled = pluginConfig.show_button;
                if (appButtonEnabled) {
                    const gameSettingsButton = await WaitForElement(`div.${findModule(e => e.InPage).InPage} div.${findModule(e => e.AppButtonsContainer).AppButtonsContainer} > div.${findModule(e => e.MenuButtonContainer).MenuButtonContainer}:not([role="button"])`, popup.m_popup.document);
                    const oldMoveButton = gameSettingsButton.parentNode!.querySelector('div.logo-move-button');
                    
                    if (!oldMoveButton) {
                        const moveButton = gameSettingsButton.cloneNode(true);
                        (moveButton as HTMLElement).classList.add("logo-move-button");
                        (moveButton.firstChild! as HTMLElement).innerHTML = "ML";
                        gameSettingsButton.parentNode!.insertBefore(moveButton, gameSettingsButton.nextSibling);
                        moveButton.addEventListener("click", movementHandler);
                    }
                }

                const contextMenuEnabled = pluginConfig.context_menu;
                if (contextMenuEnabled) {

                    // Disconnect the old observer before creating a new one to prevent conflicts.
                    if (observer) {
                        observer.disconnect();
                    }

                    const hasSpecificMenuItems = (container: HTMLElement) => {
                        // _1n7Wloe5jZ6fSuvV18NNWI == contextMenuItem
                        const itemsText = Array.from(container.querySelectorAll(`div.${findModule(e => e.ContextMenuMouseOverlay).contextMenuItem}.contextMenuItem`))
                            .map(el => el.textContent.trim());
                        // "CustomArt_EditLogoPosition":"Adjust Logo Position"
                        while (!findModule(e => e["CustomArt_EditLogoPosition"]));
                        console.log("[steam-logo-pos] CustomArt_EditLogoPosition == ", findModule(e => e["CustomArt_EditLogoPosition"])["CustomArt_EditLogoPosition"]);
                        const requiredItems = [findModule(e => e["CustomArt_EditLogoPosition"])["CustomArt_EditLogoPosition"]];
                        return requiredItems.every(item => itemsText.includes(item));
                    };

                    const addMoveLogoButton = (container: HTMLElement) => {
                        if (!hasSpecificMenuItems(container)) return;
                        if (container.querySelector('.contextMenuItem.moveLogoAdded')) return;

                        const newItem = document.createElement('div');
                        // _1n7Wloe5jZ6fSuvV18NNWI == contextMenuItem
                        newItem.setAttribute('role', `${findModule(e => e.ContextMenuMouseOverlay).contextMenuItem}`);
                        newItem.className = `${findModule(e => e.ContextMenuMouseOverlay).contextMenuItem} contextMenuItem moveLogoAdded`;
                        newItem.textContent = 'Move Logo';
                        newItem.addEventListener('click', async () => {
                            await movementHandler();
                            const parentDiv = container.parentElement;
                            if (parentDiv) parentDiv.style.display = 'none';
                            else container.style.display = 'none';
                        });
                        container.appendChild(newItem);
                        console.log('[steam-logo-pos] "Move Logo" item successfully added');
                    };

                    // Assign to the shared observer reference.
                    observer = new MutationObserver(mutations => {
                        mutations.forEach(mutation => {
                            mutation.addedNodes.forEach(node => {
                                if (node.nodeType === 1) { // Element node
                                    // _2EstNjFIIZm_WUSKm5Wt7n == contextMenuContents
                                    const container = (node as HTMLElement).querySelector(`div.${findModule(e => e.ContextMenuMouseOverlay).contextMenuContents}`) ||
                                        ((node as HTMLElement).classList && (node as HTMLElement).classList.contains(`${findModule(e => e.ContextMenuMouseOverlay).contextMenuContents}`) ? node : null);
                                    if (container) {
                                        addMoveLogoButton(container as HTMLElement);
                                    }
                                }
                            });
                        });
                    });

                    observer.observe(popup.m_popup.document.body, { childList: true, subtree: true });
                }
            }
        });
    }
}

type BoolKeys = {
    [K in keyof PluginConfig]: PluginConfig[K] extends boolean ? K : never
  }[keyof PluginConfig];
  
type StringKeys = {
    [K in keyof PluginConfig]: PluginConfig[K] extends string ? K : never
}[keyof PluginConfig];

type SingleSettingProps =
  | { type: "bool"; name: BoolKeys; label: string; description: string }
  | { type: "text"; name: StringKeys; label: string; description: string };

const SingleSetting = (props: SingleSettingProps) => {
    const [boolValue, setBoolValue] = useState(false);

    const saveConfig = () => {
        localStorage.setItem("luthor112.steam-logo-pos.config", JSON.stringify(pluginConfig));
    };

    useEffect(() => {
        if (props.type === "bool") {
            setBoolValue(pluginConfig[props.name]);
        }
    }, []);

    if (props.type === "bool") {
        return (
            <Field label={props.label} description={props.description} bottomSeparator="standard" focusable>
                <Toggle value={boolValue} onChange={(value) => { setBoolValue(value); pluginConfig[props.name] = value; saveConfig(); }} />
            </Field>
        );
    } else if (props.type === "text") {
        return (
            <Field label={props.label} description={props.description} bottomSeparator="standard" focusable>
                <TextField defaultValue={pluginConfig[props.name]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { (pluginConfig as any)[props.name] = e.currentTarget.value; saveConfig(); }} />
            </Field>
        );
    } else {
        return (
            <div>This should not happen...</div>
        );
    }
}

const SettingsContent = () => {
    return (
        <div>
            <SingleSetting name="context_menu" type="bool" label="Context menu option" description="Add Move Logo option to context menu" />
            <SingleSetting name="show_button" type="bool" label="Show button" description="Add ML button to applcation page" />
            <DialogButton onClick={async (e) => {
                console.log("[steam-logo-pos] Importing database");
                
                const openTag = (e.target as HTMLElement).ownerDocument.createElement("input");
                openTag.type = "file";
                openTag.accept = "text/plain";
                openTag.onchange = (e) => {
                    console.log("[steam-logo-pos] File selected!");

                    const reader = new FileReader();
                    reader.onload = function() {
                        const fileText = reader.result;
                        if (fileText !== null) {
                            posDB = JSON.parse(fileText as string);
                            localStorage.setItem("luthor112.steam-logo-pos.posdb", JSON.stringify(posDB));
                        }

                        (e.target as HTMLElement).remove();
                    };
                    reader.readAsText((e.target as HTMLInputElement)!.files![0]);
                };

                (e.target as HTMLElement).parentElement!.appendChild(openTag);
                openTag.click();
            }}>Import database</DialogButton>
            <DialogButton onClick={async () => {
                console.log("[steam-logo-pos] Exporting database");
                const exportText = "data:text/plain;base64," + btoa(JSON.stringify(posDB));
                SteamClient.Browser.StartDownload(exportText);
            }}>Export database</DialogButton>
        </div>
    );
};

export default definePlugin(async () => {
    console.log("[steam-logo-pos] Frontend startup");
    
    const rawValue = localStorage.getItem("luthor112.steam-logo-pos.config");
    const storedConfig: Partial<PluginConfig> = rawValue ? JSON.parse(rawValue) : {};
    pluginConfig = { ...pluginConfig, ...storedConfig };
    console.log("[steam-logo-pos] Merged config:", pluginConfig);

    const rawDBValue = localStorage.getItem("luthor112.steam-logo-pos.posdb");
    const storedDB: PosDB = rawDBValue ? JSON.parse(rawDBValue) : {};
    posDB = { ...posDB, ...storedDB };
    console.log("[steam-logo-pos] PosDB loaded");
    
    Millennium.AddWindowCreateHook!(OnPopupCreation);
    
    return {
		title: "Custom Logo Position",
		icon: <IconsModule.Settings />,
		content: <SettingsContent />,
	};
});
