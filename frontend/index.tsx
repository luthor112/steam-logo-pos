import { findModule, Millennium, sleep, DialogButton, IconsModule, definePlugin, Field, TextField, Toggle } from "@steambrew/client";
import { createRoot } from "react-dom/client";
import React, { useState, useEffect } from "react";

const WaitForElement = async (sel: string, parent = document) =>
    [...(await Millennium.findElement(parent, sel))][0];

var pluginConfig = {
    context_menu: false,
    show_button: true
};

type LogoState = {
    x: number;
    y: number;
    w: number;
    h: number;
};

var posDB: Record<string, any> = {};

function getDefaultState(): LogoState {
    return { x: -1, y: -1, w: -1, h: -1 };
}

function getAppState(appId: number): LogoState {
    const raw = posDB[appId.toString()];
    if (!raw) {
        return getDefaultState();
    }

    if (Array.isArray(raw)) {
        return {
            x: typeof raw[0] === "number" ? raw[0] : -1,
            y: typeof raw[1] === "number" ? raw[1] : -1,
            w: -1,
            h: -1
        };
    }

    return {
        x: typeof raw.x === "number" ? raw.x : -1,
        y: typeof raw.y === "number" ? raw.y : -1,
        w: typeof raw.w === "number" ? raw.w : -1,
        h: typeof raw.h === "number" ? raw.h : -1
    };
}

function setAppState(appId: number, partial: Partial<LogoState>) {
    const current = getAppState(appId);
    posDB[appId.toString()] = { ...current, ...partial };
    localStorage.setItem("luthor112.steam-logo-pos.posdb", JSON.stringify(posDB));
}

function clearAppState(appId: number) {
    delete posDB[appId.toString()];
    localStorage.setItem("luthor112.steam-logo-pos.posdb", JSON.stringify(posDB));
}

function applyStateToLogo(el: HTMLElement, state: LogoState) {
    if (state.x !== -1) {
        el.style.left = `${state.x}px`;
    }
    if (state.y !== -1) {
        el.style.top = `${state.y}px`;
    }
    if (state.w > 0) {
        el.style.width = `${state.w}px`;
    }
    if (state.h > 0) {
        el.style.height = `${state.h}px`;
    }
}

function clearLogoLayout(el: HTMLElement) {
    el.style.left = "";
    el.style.top = "";
    el.style.width = "";
    el.style.height = "";
}

function removeResizeHandles(el: HTMLElement) {
    const handles = el.querySelectorAll(".logo-resize-handle");
    handles.forEach((h) => h.remove());
}

function ensureResizeHandles(el: HTMLElement) {
    const defs = [
        { dir: "n", cursor: "ns-resize", left: "50%", top: "-8px", transform: "translateX(-50%)" },
        { dir: "s", cursor: "ns-resize", left: "50%", top: "calc(100% - 6px)", transform: "translateX(-50%)" },
        { dir: "e", cursor: "ew-resize", left: "calc(100% - 6px)", top: "50%", transform: "translateY(-50%)" },
        { dir: "w", cursor: "ew-resize", left: "-8px", top: "50%", transform: "translateY(-50%)" },
        { dir: "ne", cursor: "nesw-resize", left: "calc(100% - 6px)", top: "-8px", transform: "none" },
        { dir: "nw", cursor: "nwse-resize", left: "-8px", top: "-8px", transform: "none" },
        { dir: "se", cursor: "nwse-resize", left: "calc(100% - 6px)", top: "calc(100% - 6px)", transform: "none" },
        { dir: "sw", cursor: "nesw-resize", left: "-8px", top: "calc(100% - 6px)", transform: "none" }
    ];

    const handles: HTMLElement[] = [];
    defs.forEach((def) => {
        let handle = el.querySelector(`.logo-resize-handle[data-dir=\"${def.dir}\"]`) as HTMLElement | null;
        if (!handle) {
            handle = document.createElement("div");
            handle.className = "logo-resize-handle";
            handle.dataset.dir = def.dir;
            handle.style.position = "absolute";
            handle.style.width = "12px";
            handle.style.height = "12px";
            handle.style.borderRadius = "50%";
            handle.style.background = "#66c0f4";
            handle.style.border = "2px solid #1b2838";
            handle.style.zIndex = "99";
            el.appendChild(handle);
        }

        handle.style.cursor = def.cursor;
        handle.style.left = def.left;
        handle.style.top = def.top;
        handle.style.transform = def.transform;
        handles.push(handle);
    });

    return handles;
}

async function OnPopupCreation(popup: any) {
    if (popup.m_strName !== "SP Desktop_uid0") {
        return;
    }

    let contextMenuObserver: MutationObserver | null = null;

    let mwbm = undefined;
    while (!mwbm) {
        try {
            mwbm = MainWindowBrowserManager;
        } catch {
            await sleep(100);
        }
    }

    MainWindowBrowserManager.m_browser.on("finished-request", async () => {
        try {
            if (!MainWindowBrowserManager?.m_lastLocation?.pathname?.startsWith("/library/app/")) {
                return;
            }
            if (typeof uiStore === "undefined" || !uiStore?.currentGameListSelection) {
                return;
            }

            const appId = uiStore.currentGameListSelection.nAppId;
            let sizerDiv = await WaitForElement(`div.${findModule((e: any) => e.BoxSizer).BoxSizer}`, popup.m_popup.document) as HTMLElement;
            if (!sizerDiv) {
                return;
            }

            let state = getAppState(appId);
            applyStateToLogo(sizerDiv, state);

            let controlsRoot: any = null;
            let controlsContainer: HTMLElement | null = null;

            const stopInteractions = () => {
                popup.m_popup.document.onmouseup = null;
                popup.m_popup.document.onmousemove = null;
                sizerDiv.onmousedown = null;
                sizerDiv.style.cursor = "";
                removeResizeHandles(sizerDiv);
            };

            const saveCurrentLayout = () => {
                setAppState(appId, {
                    x: sizerDiv.offsetLeft,
                    y: sizerDiv.offsetTop,
                    w: sizerDiv.offsetWidth,
                    h: sizerDiv.offsetHeight
                });
            };

            const enableEditControls = () => {
                let dragMode: "move" | "resize" | null = null;
                let resizeDir = "";
                let startX = 0;
                let startY = 0;
                let startLeft = 0;
                let startTop = 0;
                let startWidth = 0;
                let startHeight = 0;
                let aspectRatio = 1;

                const handles = ensureResizeHandles(sizerDiv);
                sizerDiv.style.cursor = "move";

                sizerDiv.onmousedown = (e: any) => {
                    if ((e.target as HTMLElement)?.classList?.contains("logo-resize-handle")) {
                        return;
                    }

                    e.preventDefault();
                    dragMode = "move";
                    startX = e.clientX;
                    startY = e.clientY;
                    startLeft = sizerDiv.offsetLeft;
                    startTop = sizerDiv.offsetTop;
                };

                handles.forEach((handle) => {
                    handle.onmousedown = (e: any) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dragMode = "resize";
                        resizeDir = handle.dataset.dir || "se";
                        startX = e.clientX;
                        startY = e.clientY;
                        startLeft = sizerDiv.offsetLeft;
                        startTop = sizerDiv.offsetTop;
                        startWidth = sizerDiv.offsetWidth;
                        startHeight = sizerDiv.offsetHeight;
                        aspectRatio = startHeight > 0 ? startWidth / startHeight : 1;
                    };
                });

                popup.m_popup.document.onmousemove = (e: any) => {
                    if (!dragMode) {
                        return;
                    }

                    e.preventDefault();
                    if (dragMode === "move") {
                        const dx = e.clientX - startX;
                        const dy = e.clientY - startY;
                        sizerDiv.style.left = `${startLeft + dx}px`;
                        sizerDiv.style.top = `${startTop + dy}px`;
                        return;
                    }

                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    let newLeft = startLeft;
                    let newTop = startTop;
                    let newWidth = startWidth;
                    let newHeight = startHeight;
                    const minSize = 60;

                    if (resizeDir.includes("e")) {
                        newWidth = startWidth + dx;
                    }
                    if (resizeDir.includes("s")) {
                        newHeight = startHeight + dy;
                    }
                    if (resizeDir.includes("w")) {
                        newWidth = startWidth - dx;
                        newLeft = startLeft + dx;
                    }
                    if (resizeDir.includes("n")) {
                        newHeight = startHeight - dy;
                        newTop = startTop + dy;
                    }

                    if (newWidth < minSize) {
                        if (resizeDir.includes("w")) {
                            newLeft = startLeft + (startWidth - minSize);
                        }
                        newWidth = minSize;
                    }
                    if (newHeight < minSize) {
                        if (resizeDir.includes("n")) {
                            newTop = startTop + (startHeight - minSize);
                        }
                        newHeight = minSize;
                    }

                    if (e.shiftKey && aspectRatio > 0) {
                        const widthDelta = Math.abs(newWidth - startWidth);
                        const heightDelta = Math.abs(newHeight - startHeight);

                        if (widthDelta >= heightDelta) {
                            const adjustedHeight = Math.max(minSize, Math.round(newWidth / aspectRatio));
                            if (resizeDir.includes("n")) {
                                newTop = startTop + (startHeight - adjustedHeight);
                            }
                            newHeight = adjustedHeight;
                        } else {
                            const adjustedWidth = Math.max(minSize, Math.round(newHeight * aspectRatio));
                            if (resizeDir.includes("w")) {
                                newLeft = startLeft + (startWidth - adjustedWidth);
                            }
                            newWidth = adjustedWidth;
                        }
                    }

                    sizerDiv.style.left = `${newLeft}px`;
                    sizerDiv.style.top = `${newTop}px`;
                    sizerDiv.style.width = `${newWidth}px`;
                    sizerDiv.style.height = `${newHeight}px`;
                };

                popup.m_popup.document.onmouseup = () => {
                    if (!dragMode) {
                        return;
                    }
                    dragMode = null;
                    saveCurrentLayout();
                };
            };

            const ensureControls = async (onDone: () => void, onReset: () => void) => {
                const topCapsuleDiv = await WaitForElement(`div.${findModule((e: any) => e.TopCapsule).TopCapsule}`, popup.m_popup.document) as HTMLElement;
                if (!topCapsuleDiv) {
                    return;
                }

                controlsContainer = topCapsuleDiv.querySelector("div.logo-move-controls");
                if (!controlsContainer) {
                    controlsContainer = document.createElement("div");
                    controlsContainer.className = "logo-move-controls";
                    controlsContainer.style.position = "absolute";
                    controlsContainer.style.right = "20px";
                    controlsContainer.style.bottom = "20px";
                    controlsContainer.style.display = "flex";
                    controlsContainer.style.gap = "8px";
                    topCapsuleDiv.appendChild(controlsContainer);
                    controlsRoot = createRoot(controlsContainer);
                }

                if (!controlsRoot && controlsContainer) {
                    controlsRoot = createRoot(controlsContainer);
                }

                controlsContainer.style.display = "";
                controlsRoot.render(
                    <>
                        <DialogButton style={{ width: "fit-content", padding: "0px 20px" }} onClick={onDone}>Done</DialogButton>
                        <DialogButton style={{ width: "fit-content", padding: "0px 20px" }} onClick={onReset}>Reset</DialogButton>
                    </>
                );
            };

            const hideControls = async () => {
                const topCapsuleDiv = await WaitForElement(`div.${findModule((e: any) => e.TopCapsule).TopCapsule}`, popup.m_popup.document) as HTMLElement;
                if (!topCapsuleDiv) {
                    return;
                }
                const existing = topCapsuleDiv.querySelector("div.logo-move-controls") as HTMLElement | null;
                if (existing) {
                    existing.style.display = "none";
                }
            };

            const enterEditMode = async () => {
                const currentSizer = await WaitForElement(`div.${findModule((e: any) => e.BoxSizer).BoxSizer}`, popup.m_popup.document) as HTMLElement;
                if (currentSizer) {
                    sizerDiv = currentSizer;
                    state = getAppState(appId);
                    applyStateToLogo(sizerDiv, state);
                }

                const exitEditMode = async () => {
                    stopInteractions();
                    sizerDiv.classList.remove("logopos-header");
                    await hideControls();
                    saveCurrentLayout();
                };

                const resetLayout = async () => {
                    clearAppState(appId);
                    clearLogoLayout(sizerDiv);
                    state = getDefaultState();
                    stopInteractions();
                    enableEditControls();
                    await ensureControls(exitEditMode, resetLayout);
                };

                sizerDiv.classList.add("logopos-header");
                stopInteractions();
                enableEditControls();
                await ensureControls(exitEditMode, resetLayout);
            };

            if (pluginConfig.show_button) {
                let gameSettingsButton: HTMLElement | null = null;
                for (let i = 0; i < 40 && !gameSettingsButton; i++) {
                    gameSettingsButton = await WaitForElement(`div.${findModule((e: any) => e.InPage).InPage} div.${findModule((e: any) => e.AppButtonsContainer).AppButtonsContainer} > div.${findModule((e: any) => e.MenuButtonContainer).MenuButtonContainer}:not([role=\"button\"])`, popup.m_popup.document) as HTMLElement;
                    if (!gameSettingsButton) {
                        await sleep(75);
                    }
                }

                if (gameSettingsButton?.parentNode && !gameSettingsButton.parentNode.querySelector("div.logo-move-button")) {
                    const moveButton = gameSettingsButton.cloneNode(true) as HTMLElement;
                    moveButton.classList.add("logo-move-button");
                    if (moveButton.firstChild) {
                        (moveButton.firstChild as HTMLElement).innerHTML = "ML";
                    }
                    gameSettingsButton.parentNode.insertBefore(moveButton, gameSettingsButton.nextSibling);
                    moveButton.addEventListener("click", enterEditMode);
                }
            }

            if (pluginConfig.context_menu) {
                if (contextMenuObserver) {
                    contextMenuObserver.disconnect();
                }

                const hasSpecificMenuItems = (container: Element) => {
                    const menuOverlay = findModule((e: any) => e.ContextMenuMouseOverlay);
                    const logoModule = findModule((e: any) => e["CustomArt_EditLogoPosition"]);
                    if (!menuOverlay?.contextMenuItem || !logoModule?.["CustomArt_EditLogoPosition"]) {
                        return false;
                    }

                    const itemsText = Array.from(container.querySelectorAll(`div.${menuOverlay.contextMenuItem}.contextMenuItem`))
                        .map((el: any) => el.textContent.trim());
                    const required = [logoModule["CustomArt_EditLogoPosition"]];
                    return required.every((item) => itemsText.includes(item));
                };

                const addMoveLogoButton = (container: Element) => {
                    if (!hasSpecificMenuItems(container)) {
                        return;
                    }
                    if (container.querySelector(".contextMenuItem.moveLogoAdded")) {
                        return;
                    }

                    const menuOverlay = findModule((e: any) => e.ContextMenuMouseOverlay);
                    if (!menuOverlay?.contextMenuItem) {
                        return;
                    }

                    const newItem = document.createElement("div");
                    newItem.setAttribute("role", `${menuOverlay.contextMenuItem}`);
                    newItem.className = `${menuOverlay.contextMenuItem} contextMenuItem moveLogoAdded`;
                    newItem.textContent = "Edit Logo (Move/Resize)";
                    newItem.addEventListener("click", async () => {
                        await enterEditMode();
                        const parentDiv = container.parentElement;
                        if (parentDiv) {
                            (parentDiv as HTMLElement).style.display = "none";
                        } else {
                            (container as HTMLElement).style.display = "none";
                        }
                    });
                    container.appendChild(newItem);
                };

                contextMenuObserver = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType !== 1) {
                                return;
                            }

                            const overlay = findModule((e: any) => e.ContextMenuMouseOverlay);
                            if (!overlay?.contextMenuContents) {
                                return;
                            }

                            const el = node as HTMLElement;
                            const container = el.querySelector(`div.${overlay.contextMenuContents}`) ||
                                (el.classList?.contains(`${overlay.contextMenuContents}`) ? el : null);
                            if (container) {
                                addMoveLogoButton(container);
                            }
                        });
                    });
                });

                contextMenuObserver.observe(popup.m_popup.document.body, { childList: true, subtree: true });
            }
        } catch (err) {
            console.error("[steam-logo-pos] finished-request handler failed:", err);
        }
    });
}

const SingleSetting = (props: any) => {
    const [boolValue, setBoolValue] = useState(false);

    const saveConfig = () => {
        localStorage.setItem("luthor112.steam-logo-pos.config", JSON.stringify(pluginConfig));
    };

    useEffect(() => {
        if (props.type === "bool") {
            setBoolValue(pluginConfig[props.name as keyof typeof pluginConfig]);
        }
    }, []);

    if (props.type === "bool") {
        return (
            <Field label={props.label} description={props.description} bottomSeparator="standard" focusable>
                <Toggle value={boolValue} onChange={(value: boolean) => { setBoolValue(value); (pluginConfig as any)[props.name] = value; saveConfig(); }} />
            </Field>
        );
    } else if (props.type === "text") {
        return (
            <Field label={props.label} description={props.description} bottomSeparator="standard" focusable>
                <TextField defaultValue={(pluginConfig as any)[props.name]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { (pluginConfig as any)[props.name] = e.currentTarget.value; saveConfig(); }} />
            </Field>
        );
    }

    return null;
};

const SettingsContent = () => {
    return (
        <div>
            <SingleSetting name="context_menu" type="bool" label="Context menu option" description="Add Move Logo option to context menu" />
            <SingleSetting name="show_button" type="bool" label="Show button" description="Add ML button to application page" />
        </div>
    );
};

async function pluginMain() {
    console.log("[steam-logo-pos] Frontend startup");
    await App.WaitForServicesInitialized();
    await sleep(100);

    while (
        typeof g_PopupManager === "undefined" ||
        typeof MainWindowBrowserManager === "undefined"
    ) {
        await sleep(100);
    }

    const storedConfig = JSON.parse(localStorage.getItem("luthor112.steam-logo-pos.config") || "null");
    pluginConfig = { ...pluginConfig, ...storedConfig };

    const storedDB = JSON.parse(localStorage.getItem("luthor112.steam-logo-pos.posdb") || "null");
    posDB = { ...posDB, ...storedDB };

    const doc = g_PopupManager.GetExistingPopup("SP Desktop_uid0");
    if (doc) {
        OnPopupCreation(doc);
    }

    g_PopupManager.AddPopupCreatedCallback(OnPopupCreation);
}

export default definePlugin(async () => {
    await pluginMain();
    return {
        title: "Custom Logo Position",
        icon: <IconsModule.Settings />,
        content: <SettingsContent />,
    };
});