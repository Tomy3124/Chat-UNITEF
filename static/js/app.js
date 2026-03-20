document.addEventListener("DOMContentLoaded", () => {
    const applyViewportHeight = () => {
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        document.documentElement.style.setProperty("--wa-app-height", `${viewportHeight}px`);
    };

    applyViewportHeight();
    window.addEventListener("resize", applyViewportHeight);
    window.visualViewport?.addEventListener("resize", applyViewportHeight);
    window.visualViewport?.addEventListener("scroll", applyViewportHeight);

    const roleInput = document.getElementById("id_rol");
    const roleGroups = document.querySelectorAll("[data-role-group]");
    const loginForm = document.getElementById("loginAutoForm");
    const loginSubmit = loginForm?.querySelector("button[type='submit']");

    const drawerTriggers = document.querySelectorAll("[data-drawer-target]");
    const drawerClosers = document.querySelectorAll("[data-drawer-close]");
    const themeToggleButtons = document.querySelectorAll("[data-theme-toggle]");
    const contactManageButton = document.querySelector("[data-contact-manage]");
    const contactCancelButton = document.querySelector("[data-contact-manage-cancel]");
    const waShell = document.querySelector("[data-chat-shell]");

    const messageForm = document.getElementById("messageForm");
    const messageInput = document.getElementById("messageInput");
    const fileInput = document.getElementById("waFileInput");
    const attachToggle = document.getElementById("attachToggle");
    const attachMenu = document.getElementById("attachMenu");
    const attachFileBtn = document.getElementById("attachFileBtn");
    const attachInfo = document.getElementById("attachInfo");
    const messagesPanel = document.getElementById("messages");
    const headerChatMenuToggle = document.getElementById("headerChatMenuToggle");
    const headerChatMenu = document.getElementById("headerChatMenu");
    const selectionToolbar = document.getElementById("waSelectionToolbar");
    const selectionCount = document.getElementById("waSelectionCount");

    const chatSearch = document.getElementById("chatSearch");
    const filterButtons = document.querySelectorAll("[data-chat-filter]");
    const chatItems = document.querySelectorAll(".wa-chat-item");

    const noticesList = document.getElementById("noticesList");
    const assignmentsList = document.getElementById("assignmentsList");
    const sidePanel = document.getElementById("waInfoPanel");
    const sidePanelTitle = document.getElementById("waInfoTitle");
    const sidePanelOpeners = document.querySelectorAll("[data-side-panel]");
    const sidePanelCloser = document.querySelector("[data-close-side-panel]");
    const activeChatItem = document.querySelector(".wa-chat-item.is-active");

    const editAvisoButtons = document.querySelectorAll("[data-edit-aviso]");
    const deleteAvisoButtons = document.querySelectorAll("[data-delete-aviso]");

    const messageActionMenu = document.getElementById("messageActionMenu");
    const waModal = document.getElementById("waModal");
    const waModalTitle = document.getElementById("waModalTitle");
    const waModalBody = document.getElementById("waModalBody");
    const waModalActions = document.getElementById("waModalActions");

    let contactSelectionMode = false;
    let messageSelectionMode = false;
    const selectedMessages = new Set();
    const panelReadRequests = new Set();

    const getCsrfToken = () => {
        if (window.chatConfig?.csrfToken) {
            return window.chatConfig.csrfToken;
        }
        const cookie = document.cookie
            .split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith("csrftoken="));
        return cookie ? decodeURIComponent(cookie.split("=")[1]) : "";
    };

    const postForm = async (url, formData) => {
        const csrfToken = getCsrfToken();
        const response = await fetch(url, {
            method: "POST",
            body: formData,
            headers: {
                "X-CSRFToken": csrfToken,
            },
        });
        let payload = null;
        try {
            payload = await response.json();
        } catch {
            payload = null;
        }
        return { ok: response.ok, payload };
    };

    const escapeHtml = (value) =>
        String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    const browserNotificationsSupported = typeof window !== "undefined" && "Notification" in window;
    const shownNotificationKeys = new Set();
    const currentViewerId = Number(window.chatConfig?.currentUserId || messagesPanel?.dataset.userId || 0);

    const requestNotificationPermission = async () => {
        if (!browserNotificationsSupported || Notification.permission !== "default") {
            return;
        }
        try {
            await Notification.requestPermission();
        } catch {
            // Algunos navegadores pueden rechazar la solicitud sin interaccion suficiente.
        }
    };

    const scheduleNotificationPermissionPrompt = () => {
        if (!browserNotificationsSupported || Notification.permission !== "default") {
            return;
        }

        const askOnce = () => {
            void requestNotificationPermission();
            window.removeEventListener("pointerdown", askOnce);
            window.removeEventListener("keydown", askOnce);
        };

        window.addEventListener("pointerdown", askOnce, { once: true });
        window.addEventListener("keydown", askOnce, { once: true });
    };

    const shouldDisplayBrowserNotification = () => {
        if (!browserNotificationsSupported || Notification.permission !== "granted") {
            return false;
        }
        return document.hidden || !document.hasFocus();
    };

    const rememberNotification = (key) => {
        if (!key || shownNotificationKeys.has(key)) {
            return false;
        }
        shownNotificationKeys.add(key);
        window.setTimeout(() => shownNotificationKeys.delete(key), 15000);
        return true;
    };

    const getNotificationTargetUrl = (payload, item) => {
        if (item?.href) {
            return item.href;
        }
        if (payload?.departamento_id) {
            return `/chat/departamento/${payload.departamento_id}/`;
        }
        return window.location.href;
    };

    const notifyIncomingPayload = (payload, item = null) => {
        if (!payload || !shouldDisplayBrowserNotification()) {
            return;
        }

        if (payload.kind === "message" && Number(payload.usuario_id || 0) === currentViewerId) {
            return;
        }
        if (payload.kind === "notice" && Number(payload.directiva_id || 0) === currentViewerId) {
            return;
        }

        const key = `${payload.kind || "event"}:${payload.action || "new"}:${payload.id || payload.fecha || Math.random()}`;
        if (!rememberNotification(key)) {
            return;
        }

        let title = "Chat UNITEF";
        let body = "";
        const timestamp = Number(payload.timestamp || Date.now());

        if (payload.kind === "notice") {
            title = payload.emisor || payload.tipo_label || "UNITEF";
            const summary = [payload.tipo_label, payload.titulo].filter(Boolean).join(": ");
            body = payload.contenido || summary || "Nueva actualizacion";
        } else {
            title = payload.usuario || payload.autor_tipo_label || "Nuevo mensaje";
            body = (payload.contenido || "").trim() || (payload.archivo_nombre ? `Archivo: ${payload.archivo_nombre}` : "Nuevo mensaje");
        }

        const notification = new Notification(title, {
            body,
            icon: window.chatConfig?.notificationIcon,
            badge: window.chatConfig?.notificationIcon,
            timestamp,
            tag: key,
            renotify: false,
        });

        notification.onclick = () => {
            window.focus();
            window.location.href = getNotificationTargetUrl(payload, item);
            notification.close();
        };
    };

    scheduleNotificationPermissionPrompt();

    const autoresizeMessageInput = () => {
        if (!messageInput) {
            return;
        }
        messageInput.style.height = "auto";
        const nextHeight = Math.min(messageInput.scrollHeight, 144);
        messageInput.style.height = `${Math.max(nextHeight, 44)}px`;
    };

    const buildFileAttachmentHtml = (message) => {
        if (!message.archivo_url) {
            return "";
        }

        const openUrl = message.archivo_abrir_url || message.archivo_url;
        const downloadUrl = message.archivo_descargar_url || message.archivo_url;
        return `
            <div class="wa-file-card">
                <div class="wa-file-name">📄 ${escapeHtml(message.archivo_nombre || "Archivo")}</div>
                <div class="wa-file-actions">
                    <a class="wa-file-link" href="${openUrl}" target="_blank" rel="noopener">Abrir</a>
                    <a class="wa-file-link" href="${downloadUrl}">Guardar como</a>
                </div>
            </div>
        `;
    };

    const applyTheme = (theme) => {
        document.body.classList.toggle("theme-light", theme === "light");
        window.localStorage.setItem("chat-unitef-theme", theme);
    };

    applyTheme(window.localStorage.getItem("chat-unitef-theme") || "dark");

    if (waShell) {
        document.body.classList.add("wa-app-active");
    }

    const openDrawer = (id) => {
        const drawer = document.getElementById(id);
        if (drawer) {
            drawer.classList.add("is-open");
        }
    };

    const closeDrawers = () => {
        document.querySelectorAll(".action-drawer.is-open").forEach((drawer) => {
            drawer.classList.remove("is-open");
        });
    };

    const exitContactSelectionMode = () => {
        contactSelectionMode = false;
        document.body.classList.remove("wa-contact-selecting");
        chatItems.forEach((item) => item.classList.remove("is-contact-selected"));
        if (contactManageButton) {
            contactManageButton.textContent = "Eliminar";
        }
        if (contactCancelButton) {
            contactCancelButton.hidden = true;
        }
    };

    const closeWaModal = () => {
        if (!waModal) {
            return;
        }
        waModal.hidden = true;
        waModalBody.innerHTML = "";
        waModalActions.innerHTML = "";
    };

    const getSelectedDepartmentIds = () =>
        Array.from(chatItems)
            .filter((item) => item.classList.contains("is-contact-selected"))
            .map((item) => item.dataset.departamentoId)
            .filter(Boolean);

    const openWaModal = ({ title, body, actions }) => {
        if (!waModal || !waModalTitle || !waModalBody || !waModalActions) {
            return;
        }
        waModalTitle.textContent = title;
        waModalBody.innerHTML = "";
        if (typeof body === "string") {
            waModalBody.innerHTML = body;
        } else if (body instanceof HTMLElement) {
            waModalBody.appendChild(body);
        }
        waModalActions.innerHTML = "";
        actions.forEach((action) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = action.danger ? "danger" : "";
            button.textContent = action.label;
            button.addEventListener("click", action.onClick);
            waModalActions.appendChild(button);
        });
        waModal.hidden = false;
    };

    drawerTriggers.forEach((button) => {
        button.addEventListener("click", () => openDrawer(button.dataset.drawerTarget));
    });

    themeToggleButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const nextTheme = document.body.classList.contains("theme-light") ? "dark" : "light";
            applyTheme(nextTheme);
        });
    });

    drawerClosers.forEach((button) => {
        button.addEventListener("click", closeDrawers);
    });

    const applyRoleState = () => {
        if (!roleInput) {
            return;
        }

        roleGroups.forEach((field) => {
            const wrapper = field.closest("p");
            if (!wrapper) {
                return;
            }
            const shouldShow = field.dataset.roleGroup === roleInput.value;
            wrapper.classList.toggle("role-hidden", !shouldShow);
        });

        if (loginForm) {
            loginForm.classList.toggle("is-directiva", roleInput.value === "directiva");
            loginForm.classList.toggle("is-departamento", roleInput.value === "departamento");
        }

        if (loginSubmit) {
            loginSubmit.textContent =
                roleInput.value === "directiva"
                    ? "Entrar como Directiva"
                    : "Entrar como Departamento";
        }
    };

    if (roleInput) {
        applyRoleState();
        roleInput.addEventListener("change", applyRoleState);
    }

    const runChatFilters = () => {
        if (!chatItems.length) {
            return;
        }

        const query = (chatSearch?.value || "").trim().toLowerCase();
        const activeFilter = document.querySelector("[data-chat-filter].is-active")?.dataset.chatFilter || "all";

        chatItems.forEach((item) => {
            const name = item.dataset.chatName || "";
            const lastMessage = item.dataset.lastMessage || "";
            const unread = Number(item.dataset.unread || 0);

            const matchesSearch = !query || name.includes(query) || lastMessage.includes(query);
            const matchesFilter =
                activeFilter === "all" ||
                (activeFilter === "unread" && unread > 0);

            item.classList.toggle("d-none", !(matchesSearch && matchesFilter));
        });
    };

    const setPanelIndicator = (panelName, visible) => {
        const button = document.querySelector(`.wa-panel-toggle[data-side-panel="${panelName}"]`);
        if (!button) {
            return;
        }
        button.classList.toggle("has-indicator", visible);
    };

    const getPanelButton = (panelName) => document.querySelector(`.wa-panel-toggle[data-side-panel="${panelName}"]`);

    const getPanelUnreadCount = (panelName) => Number(getPanelButton(panelName)?.dataset.unreadCount || 0);

    const updatePanelUnreadState = (panelName, nextCount) => {
        const button = getPanelButton(panelName);
        if (!button) {
            return;
        }

        const safeNextCount = Math.max(0, nextCount);
        button.dataset.unreadCount = String(safeNextCount);
        setPanelIndicator(panelName, safeNextCount > 0);
    };

    const getLatestRenderedMessageId = () => Math.max(0, ...Array.from(renderedIds));

    const getLatestNoticeId = (panelName) =>
        Math.max(
            0,
            ...Array.from(document.querySelectorAll(`.wa-note[data-panel-kind="${panelName}"]`))
                .map((node) => Number(node.dataset.noticeId || 0))
                .filter((value) => Number.isFinite(value)),
        );

    const markPanelAsRead = async (panelName) => {
        if (!window.chatConfig?.markPanelReadUrl || !window.chatConfig?.isDepartmentUser) {
            return;
        }

        if (getPanelUnreadCount(panelName) <= 0 || panelReadRequests.has(panelName)) {
            return;
        }

        panelReadRequests.add(panelName);
        const formData = new FormData();
        formData.append("panel", panelName);

        const { ok, payload } = await postForm(window.chatConfig.markPanelReadUrl, formData);
        panelReadRequests.delete(panelName);
        if (!ok || !payload?.ok) {
            return;
        }

        updatePanelUnreadState("notices", Number(payload.no_leidos_avisos || 0));
        updatePanelUnreadState("assignments", Number(payload.no_leidos_asignaciones || 0));
    };

    const buildDepartmentOptions = () => {
        return Array.from(chatItems)
            .map((item) => {
                const id = getDepartmentIdFromChatItem(item);
                const name = item.querySelector(".wa-chat-head strong")?.textContent?.trim() || "Departamento";
                return { id, name };
            })
            .filter((item) => Number.isFinite(item.id));
    };

    const getCurrentTargetBubble = () => {
        if (selectedBubble) {
            return selectedBubble;
        }
        const firstSelectedId = Array.from(selectedMessages)[0];
        if (!firstSelectedId) {
            return null;
        }
        return document.querySelector(`.wa-bubble[data-message-id="${firstSelectedId}"]`);
    };

    const syncSelectionToolbar = () => {
        if (!selectionToolbar || !selectionCount) {
            return;
        }
        const total = selectedMessages.size;
        selectionToolbar.hidden = !messageSelectionMode;
        selectionCount.textContent = `${total} seleccionado${total === 1 ? "" : "s"}`;
    };

    const getDepartmentIdFromChatItem = (item) => {
        const href = item.getAttribute("href") || "";
        const match = href.match(/\/chat\/departamento\/(\d+)\//);
        return match ? Number(match[1]) : null;
    };

    const getActiveDepartmentId = () => {
        const socketPath = window.chatConfig?.socketPath || "";
        const match = socketPath.match(/departamento\/(\d+)\//);
        return match ? Number(match[1]) : null;
    };

    const updateUnreadBubble = (item, { reset = false, increment = 0 } = {}) => {
        const current = Number(item.dataset.unread || 0);
        const next = reset ? 0 : Math.max(0, current + increment);
        item.dataset.unread = String(next);

        let pill = item.querySelector(".wa-unread-pill");
        if (next > 0) {
            if (!pill) {
                pill = document.createElement("span");
                pill.className = "wa-unread-pill";
                item.appendChild(pill);
            }
            pill.textContent = String(next);
        } else {
            pill?.remove();
        }
    };

    const updateConversationPreviewForItem = (item, payload) => {
        const previewNode = item.querySelector(".wa-chat-meta p");
        const timeNode = item.querySelector(".wa-chat-head time");
        if (!previewNode || !timeNode) {
            return;
        }

        if (payload.kind === "notice") {
            if (payload.action === "deleted") {
                return;
            }
            const label = payload.tipo === "asignacion" ? "[ASIGNACION]" : "[AVISO]";
            const body = `${payload.titulo}: ${payload.contenido}`.trim();
            previewNode.innerHTML = `<span class="wa-last-author">${label}:</span> ${escapeHtml(body)}`;
            timeNode.textContent = "Ahora";
            item.dataset.lastMessage = body.toLowerCase();
            return;
        }

        const body = (payload.contenido || "").trim() || (payload.archivo_nombre ? "Archivo adjunto" : "Mensaje");
        const author = payload.autor_tipo_label || "Contacto";
        previewNode.innerHTML = `<span class="wa-last-author">${escapeHtml(author)}:</span> ${escapeHtml(body)}`;
        timeNode.textContent = payload.fecha || "--:--";
        item.dataset.lastMessage = body.toLowerCase();
    };

    if (chatSearch) {
        chatSearch.addEventListener("input", runChatFilters);
    }

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            filterButtons.forEach((btn) => btn.classList.remove("is-active"));
            button.classList.add("is-active");
            runChatFilters();
        });
    });

    const switchInfoPanel = (panelName) => {
        if (!sidePanel) {
            return;
        }

        const activePanel = sidePanel.dataset.activePanel || "";
        if (sidePanel.classList.contains("is-open") && activePanel === panelName) {
            sidePanel.classList.remove("is-open");
            sidePanel.dataset.activePanel = "";
            return;
        }

        if (sidePanelTitle) {
            sidePanelTitle.textContent = panelName === "notices" ? "Avisos" : "Asignaciones";
        }

        setPanelIndicator(panelName, false);

        document.querySelectorAll("[data-panel-content]").forEach((panel) => {
            panel.classList.toggle("d-none", panel.dataset.panelContent !== panelName);
        });

        sidePanel.dataset.activePanel = panelName;
        sidePanel.classList.add("is-open");

        if (window.chatConfig?.isDepartmentUser) {
            markPanelAsRead(panelName);
        }
    };

    sidePanelOpeners.forEach((button) => {
        button.addEventListener("click", () => switchInfoPanel(button.dataset.sidePanel));
    });

    if (sidePanelCloser && sidePanel) {
        sidePanelCloser.addEventListener("click", () => {
            sidePanel.classList.remove("is-open");
            sidePanel.dataset.activePanel = "";
        });
    }

    runChatFilters();
    if (activeChatItem) {
        updateUnreadBubble(activeChatItem, { reset: true });
        runChatFilters();
    }

    if (contactManageButton) {
        contactManageButton.addEventListener("click", async () => {
            if (!contactSelectionMode) {
                contactSelectionMode = true;
                document.body.classList.add("wa-contact-selecting");
                contactManageButton.textContent = "Eliminar seleccionados";
                if (contactCancelButton) {
                    contactCancelButton.hidden = false;
                }
                return;
            }

            const ids = getSelectedDepartmentIds();
            if (!ids.length) {
                exitContactSelectionMode();
                return;
            }

            openWaModal({
                title: "Eliminar departamentos",
                body: `<p>Se eliminaran ${ids.length} departamento(s) de forma permanente.</p>`,
                actions: [
                    { label: "Cancelar", onClick: closeWaModal },
                    {
                        label: "Eliminar",
                        danger: true,
                        onClick: async () => {
                            const formData = new FormData();
                            ids.forEach((id) => formData.append("departamento_ids[]", id));
                            const { ok, payload } = await postForm(window.chatConfig.deleteDepartmentsUrl, formData);
                            if (!ok || !payload?.ok) {
                                window.alert(payload?.error || "No se pudieron eliminar los departamentos.");
                                return;
                            }
                            exitContactSelectionMode();
                            window.location.href = "/inicio/";
                        },
                    },
                ],
            });
        });

        contactCancelButton?.addEventListener("click", () => {
            exitContactSelectionMode();
        });

        chatItems.forEach((item) => {
            item.addEventListener("click", (event) => {
                if (!contactSelectionMode) {
                    return;
                }
                event.preventDefault();
                item.classList.toggle("is-contact-selected");
            });
        });
    }

    if (chatItems.length) {
        const wsProtocolSidebar = window.location.protocol === "https:" ? "wss" : "ws";
        const activeDepartmentId = getActiveDepartmentId();

        chatItems.forEach((item) => {
            const departamentoId = getDepartmentIdFromChatItem(item);
            if (!departamentoId) {
                return;
            }
            if (activeDepartmentId && departamentoId === activeDepartmentId) {
                return;
            }

            const socket = new WebSocket(
                `${wsProtocolSidebar}://${window.location.host}/ws/chat/departamento/${departamentoId}/`,
            );
            socket.onmessage = (event) => {
                const payload = JSON.parse(event.data);
                const viewerDirectivaId = Number(window.chatConfig?.directivaId || 0);
                if (viewerDirectivaId && payload.directiva_id && Number(payload.directiva_id) !== viewerDirectivaId) {
                    return;
                }
                updateConversationPreviewForItem(item, payload);
                if (payload.kind !== "notice" && payload.action !== "deleted") {
                    updateUnreadBubble(item, { increment: 1 });
                }
                notifyIncomingPayload(payload, item);
                runChatFilters();
            };
        });
    }

    editAvisoButtons.forEach((button) => {
        button.addEventListener("click", async () => {
            const actualTipo = button.dataset.tipo || "aviso";
            const actualTitulo = button.dataset.titulo || "";
            const actualContenido = button.dataset.contenido || "";

            const formWrap = document.createElement("div");
            formWrap.className = "wa-modal-form";
            formWrap.innerHTML = `
                <label>Tipo</label>
                <select id="waNoticeType">
                    <option value="aviso" ${actualTipo === "aviso" ? "selected" : ""}>Aviso</option>
                    <option value="asignacion" ${actualTipo === "asignacion" ? "selected" : ""}>Asignacion</option>
                </select>
                <label>Titulo</label>
                <input id="waNoticeTitle" type="text" value="${escapeHtml(actualTitulo)}">
                <label>Contenido</label>
                <textarea id="waNoticeContent">${escapeHtml(actualContenido)}</textarea>
            `;

            openWaModal({
                title: "Editar actualizacion",
                body: formWrap,
                actions: [
                    { label: "Cancelar", onClick: closeWaModal },
                    {
                        label: "Guardar",
                        onClick: async () => {
                            const tipo = formWrap.querySelector("#waNoticeType")?.value || "aviso";
                            const titulo = formWrap.querySelector("#waNoticeTitle")?.value?.trim() || "";
                            const contenido = formWrap.querySelector("#waNoticeContent")?.value?.trim() || "";
                            const formData = new FormData();
                            formData.append("tipo", tipo);
                            formData.append("titulo", titulo);
                            formData.append("contenido", contenido);

                            const { ok, payload } = await postForm(button.dataset.url, formData);
                            if (!ok || !payload?.ok) {
                                window.alert(payload?.error || "No se pudo editar.");
                                return;
                            }

                            const note = button.closest(".wa-note");
                            if (note) {
                                const titleNode = note.querySelector("h3");
                                const contentNode = note.querySelector("p");
                                const dateNode = note.querySelector("small");
                                const typeNode = note.querySelector("span");
                                if (titleNode) titleNode.textContent = payload.titulo;
                                if (contentNode) contentNode.textContent = payload.contenido;
                                if (dateNode) dateNode.textContent = payload.fecha;
                                if (typeNode) typeNode.textContent = payload.tipo === "asignacion" ? "Asignacion" : "Aviso";
                            }
                            closeWaModal();
                        },
                    },
                ],
            });
        });
    });

    deleteAvisoButtons.forEach((button) => {
        button.addEventListener("click", async () => {
            openWaModal({
                title: "Eliminar actualizacion",
                body: "<p>¿Seguro que deseas eliminar esta actualizacion?</p>",
                actions: [
                    { label: "Cancelar", onClick: closeWaModal },
                    {
                        label: "Eliminar",
                        danger: true,
                        onClick: async () => {
                            const { ok, payload } = await postForm(button.dataset.url, new FormData());
                            if (!ok || !payload?.ok) {
                                window.alert(payload?.error || "No se pudo eliminar.");
                                return;
                            }
                            button.closest(".wa-note")?.remove();
                            closeWaModal();
                        },
                    },
                ],
            });
        });
    });

    let selectedBubble = null;
    const closeMessageMenu = () => {
        if (messageActionMenu) {
            messageActionMenu.hidden = true;
        }
        selectedBubble?.classList.remove("is-selected");
        selectedBubble = null;
    };

    const openMessageMenu = (bubble, originEvent) => {
        if (!messageActionMenu) {
            return;
        }
        selectedBubble?.classList.remove("is-selected");
        selectedBubble = bubble;
        selectedBubble.classList.add("is-selected");

        const isMine = bubble.dataset.isMine === "1";
        const editButton = messageActionMenu.querySelector("[data-menu-action='edit']");
        if (editButton) {
            editButton.hidden = !isMine;
        }

        const x = originEvent.clientX;
        const y = originEvent.clientY;
        messageActionMenu.style.left = `${x}px`;
        messageActionMenu.style.top = `${y}px`;
        messageActionMenu.hidden = false;
    };

    const runBubbleEdit = async (bubble) => {
        const actual = bubble.querySelector("p")?.textContent || "";
        const wrap = document.createElement("div");
        wrap.className = "wa-modal-form";
        wrap.innerHTML = `<label>Mensaje</label><textarea id="waEditMessageInput">${escapeHtml(actual)}</textarea>`;
        openWaModal({
            title: "Editar mensaje",
            body: wrap,
            actions: [
                { label: "Cancelar", onClick: closeWaModal },
                {
                    label: "Guardar",
                    onClick: async () => {
                        const contenido = wrap.querySelector("#waEditMessageInput")?.value?.trim() || "";
                        const formData = new FormData();
                        formData.append("contenido", contenido);
                        const { ok, payload } = await postForm(bubble.dataset.editUrl, formData);
                        if (!ok || !payload?.ok) {
                            window.alert(payload?.error || "No se pudo editar el mensaje.");
                            return;
                        }
                        const body = bubble.querySelector("p") || document.createElement("p");
                        body.textContent = payload.contenido;
                        if (!body.parentElement) {
                            bubble.appendChild(body);
                        }
                        closeWaModal();
                    },
                },
            ],
        });
    };

    const runBubbleDelete = async (bubble) => {
        const isMine = bubble.dataset.isMine === "1";
        if (isMine) {
            openWaModal({
                title: "Eliminar mensaje",
                body: "<p>Elige como quieres eliminar este mensaje.</p>",
                actions: [
                    { label: "Cancelar", onClick: closeWaModal },
                    {
                        label: "Eliminar para mi",
                        onClick: async () => {
                            const formData = new FormData();
                            formData.append("scope", "me");
                            const { ok, payload } = await postForm(bubble.dataset.deleteUrl, formData);
                            if (!ok || !payload?.ok) {
                                window.alert(payload?.error || "No se pudo eliminar.");
                                return;
                            }
                            bubble.remove();
                            closeWaModal();
                        },
                    },
                    {
                        label: "Eliminar para todos",
                        danger: true,
                        onClick: async () => {
                            const formData = new FormData();
                            formData.append("scope", "all");
                            const { ok, payload } = await postForm(bubble.dataset.deleteUrl, formData);
                            if (!ok || !payload?.ok) {
                                window.alert(payload?.error || "No se pudo eliminar para todos.");
                                return;
                            }
                            bubble.remove();
                            closeWaModal();
                        },
                    },
                ],
            });
            return;
        }

        openWaModal({
            title: "Eliminar mensaje",
            body: "<p>Este mensaje se eliminara solo para ti.</p>",
            actions: [
                { label: "Cancelar", onClick: closeWaModal },
                {
                    label: "Eliminar para mi",
                    danger: true,
                    onClick: async () => {
                        const formData = new FormData();
                        formData.append("scope", "me");
                        const { ok, payload } = await postForm(bubble.dataset.deleteUrl, formData);
                        if (!ok || !payload?.ok) {
                            window.alert(payload?.error || "No se pudo eliminar.");
                            return;
                        }
                        bubble.remove();
                        closeWaModal();
                    },
                },
            ],
        });
    };

    const runBubbleForward = async (bubble) => {
        const wrap = document.createElement("div");
        wrap.className = "wa-modal-form";
        const options = buildDepartmentOptions()
            .map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)
            .join("");
        wrap.innerHTML = `<label>Reenviar a</label><select id="waForwardDepartment">${options}</select>`;
        openWaModal({
            title: "Reenviar mensaje",
            body: wrap,
            actions: [
                { label: "Cancelar", onClick: closeWaModal },
                {
                    label: "Reenviar",
                    onClick: async () => {
                        const departamentoId = wrap.querySelector("#waForwardDepartment")?.value;
                        const formData = new FormData();
                        formData.append("departamento_id", departamentoId || "");
                        const { ok, payload } = await postForm(bubble.dataset.forwardUrl, formData);
                        if (!ok || !payload?.ok) {
                            window.alert(payload?.error || "No se pudo reenviar.");
                            return;
                        }
                        closeWaModal();
                    },
                },
            ],
        });
    };

    if (messageActionMenu) {
        messageActionMenu.addEventListener("click", async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement) || !selectedBubble) {
                return;
            }
            const action = target.dataset.menuAction;
            const isMine = selectedBubble.dataset.isMine === "1";

            if (action === "edit" && isMine) {
                runBubbleEdit(selectedBubble);
                closeMessageMenu();
                return;
            }

            if (action === "delete") {
                runBubbleDelete(selectedBubble);
                closeMessageMenu();
                return;
            }

            if (action === "forward") {
                runBubbleForward(selectedBubble);
                closeMessageMenu();
            }
        });
    }

    if (headerChatMenuToggle && headerChatMenu) {
        headerChatMenuToggle.addEventListener("click", () => {
            headerChatMenu.classList.toggle("is-open");
        });

        headerChatMenu.addEventListener("click", async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }

            const action = target.dataset.chatAction;

            if (action === "select") {
                messageSelectionMode = !messageSelectionMode;
                document.body.classList.toggle("wa-message-selecting", messageSelectionMode);
                if (!messageSelectionMode) {
                    selectedMessages.clear();
                    document.querySelectorAll(".wa-bubble.is-multi-selected").forEach((node) => node.classList.remove("is-multi-selected"));
                }
                syncSelectionToolbar();
            }

            if (action === "clear" && window.chatConfig?.clearChatUrl) {
                openWaModal({
                    title: "Vaciar chat",
                    body: "<p>Se ocultaran para ti los mensajes visibles de este chat.</p>",
                    actions: [
                        { label: "Cancelar", onClick: closeWaModal },
                        {
                            label: "Vaciar",
                            danger: true,
                            onClick: async () => {
                                const formData = new FormData();
                                if (window.chatConfig.directivaId) {
                                    formData.append("directiva_id", window.chatConfig.directivaId);
                                }
                                const { ok, payload } = await postForm(window.chatConfig.clearChatUrl, formData);
                                if (!ok || !payload?.ok) {
                                    window.alert(payload?.error || "No se pudo vaciar el chat.");
                                    return;
                                }
                                document.querySelectorAll(".wa-bubble[data-message-id]").forEach((node) => node.remove());
                                closeWaModal();
                            },
                        },
                    ],
                });
            }

            headerChatMenu.classList.remove("is-open");
        });
    }

    if (selectionToolbar) {
        selectionToolbar.addEventListener("click", async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }
            const action = target.dataset.selectionAction;

            if (action === "all") {
                document.querySelectorAll(".wa-bubble[data-message-id]").forEach((node) => {
                    const id = node.dataset.messageId;
                    if (!id) {
                        return;
                    }
                    selectedMessages.add(id);
                    node.classList.add("is-multi-selected");
                });
                syncSelectionToolbar();
            }

            if (action === "cancel") {
                messageSelectionMode = false;
                selectedMessages.clear();
                document.body.classList.remove("wa-message-selecting");
                document.querySelectorAll(".wa-bubble.is-multi-selected").forEach((node) => node.classList.remove("is-multi-selected"));
                syncSelectionToolbar();
            }

            if (action === "delete" && selectedMessages.size) {
                openWaModal({
                    title: "Eliminar seleccionados",
                    body: `<p>Se eliminaran ${selectedMessages.size} mensaje(s) para ti.</p>`,
                    actions: [
                        { label: "Cancelar", onClick: closeWaModal },
                        {
                            label: "Eliminar",
                            danger: true,
                            onClick: async () => {
                                for (const id of selectedMessages) {
                                    const node = document.querySelector(`.wa-bubble[data-message-id="${id}"]`);
                                    if (!node) {
                                        continue;
                                    }
                                    const formData = new FormData();
                                    formData.append("scope", "me");
                                    await postForm(node.dataset.deleteUrl, formData);
                                    node.remove();
                                }
                                selectedMessages.clear();
                                messageSelectionMode = false;
                                document.body.classList.remove("wa-message-selecting");
                                syncSelectionToolbar();
                                closeWaModal();
                            },
                        },
                    ],
                });
            }

            if (action === "forward" && selectedMessages.size) {
                const firstBubble = getCurrentTargetBubble();
                if (firstBubble) {
                    runBubbleForward(firstBubble);
                }
            }
        });
    }

    if (!messagesPanel || !window.chatConfig) {
        return;
    }

    const currentUserId = Number(messagesPanel.dataset.userId || 0);
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    let roomSocket = null;
    let roomSocketReconnectTimer = null;
    let updatesPollTimer = null;
    let updatesFetchInFlight = false;
    const renderedIds = new Set(
        Array.from(messagesPanel.querySelectorAll("[data-message-id]"))
            .map((node) => Number(node.dataset.messageId))
            .filter((value) => Number.isFinite(value) && value > 0),
    );

    const scrollToBottom = () => {
        messagesPanel.scrollTop = messagesPanel.scrollHeight;
    };

    const renderNoticeUpdate = (message) => {
        const panelName = message.tipo === "asignacion" ? "assignments" : "notices";
        if (message.action === "deleted") {
            document.querySelector(`[data-notice-id="${message.id}"]`)?.remove();
            return;
        }

        const isAssignment = message.tipo === "asignacion";
        const target = isAssignment ? assignmentsList : noticesList;
        if (!target) {
            return;
        }

        target.querySelector("[data-empty]")?.remove();

        const existingNote = document.querySelector(`[data-notice-id="${message.id}"]`);
        if (existingNote && message.action !== "updated") {
            const titleNode = existingNote.querySelector("h3");
            const contentNode = existingNote.querySelector("p");
            const dateNode = existingNote.querySelector("small");
            const typeNode = existingNote.querySelector("span");
            if (titleNode) titleNode.textContent = message.titulo || "Actualizacion";
            if (contentNode) contentNode.textContent = message.contenido || "";
            if (dateNode) dateNode.textContent = message.fecha || "";
            if (typeNode) typeNode.textContent = isAssignment ? "Asignacion" : "Aviso";
            existingNote.dataset.panelKind = panelName;
            return;
        }

        if (message.action === "updated") {
            document.querySelectorAll("[data-edit-aviso]").forEach((button) => {
                if (button.dataset.url?.includes(`/${message.id}/`)) {
                    button.dataset.titulo = message.titulo || "";
                    button.dataset.contenido = message.contenido || "";
                    button.dataset.tipo = message.tipo || "aviso";
                    const note = button.closest(".wa-note");
                    if (!note) {
                        return;
                    }
                    note.dataset.noticeId = String(message.id);
                    note.dataset.panelKind = panelName;
                    const titleNode = note.querySelector("h3");
                    const contentNode = note.querySelector("p");
                    const dateNode = note.querySelector("small");
                    const typeNode = note.querySelector("span");
                    if (titleNode) titleNode.textContent = message.titulo || "Actualizacion";
                    if (contentNode) contentNode.textContent = message.contenido || "";
                    if (dateNode) dateNode.textContent = message.fecha || "";
                    if (typeNode) typeNode.textContent = isAssignment ? "Asignacion" : "Aviso";
                }
            });
            return;
        }

        const article = document.createElement("article");
        article.className = `wa-note${isAssignment ? " wa-note--assignment" : ""}`;
        article.dataset.noticeId = String(message.id);
        article.dataset.panelKind = panelName;
        article.innerHTML = `
            <span>${isAssignment ? "Asignacion" : "Aviso"}</span>
            <h3>${escapeHtml(message.titulo || "Actualizacion")}</h3>
            <p>${escapeHtml(message.contenido || "")}</p>
            <small>${escapeHtml(message.fecha)}</small>
        `;
        target.prepend(article);

        if (!window.chatConfig?.isDepartmentUser || message.action === "updated") {
            return;
        }

        if (sidePanel?.classList.contains("is-open") && sidePanel.dataset.activePanel === panelName) {
            markPanelAsRead(panelName);
            return;
        }

        updatePanelUnreadState(panelName, getPanelUnreadCount(panelName) + 1);
    };

    const updateActiveConversationPreview = (message) => {
        const activeItem = document.querySelector(".wa-chat-item.is-active");
        if (!activeItem) {
            return;
        }

        const previewNode = activeItem.querySelector(".wa-chat-meta p");
        const timeNode = activeItem.querySelector(".wa-chat-head time");
        if (!previewNode || !timeNode) {
            return;
        }

        const body = (message.contenido || "").trim() || (message.archivo_nombre ? "Archivo adjunto" : "Mensaje");
        const author = message.kind === "notice"
            ? (message.tipo === "asignacion" ? "[ASIGNACION]" : "[AVISO]")
            : (message.autor_tipo_label || "Contacto");
        previewNode.innerHTML = `<span class="wa-last-author">${escapeHtml(author)}:</span> ${escapeHtml(body)}`;
        timeNode.textContent = message.fecha || "--:--";
        activeItem.dataset.lastMessage = body.toLowerCase();
    };

    const renderMessage = (message) => {
        if (message.kind === "notice") {
            renderNoticeUpdate(message);
            return;
        }

        if (message.es_sistema) {
            return;
        }

        if (message.id && renderedIds.has(Number(message.id))) {
            return;
        }

        const isMine = Number(message.usuario_id || 0) === currentUserId;
        const article = document.createElement("article");
        article.className = `wa-bubble ${isMine ? "mine" : "theirs"}`;
        if (message.id) {
            article.dataset.messageId = String(message.id);
            renderedIds.add(Number(message.id));
        }

        let html = `
            <header>
                <strong>${escapeHtml(message.usuario)}</strong>
                <time>${escapeHtml(message.fecha)}</time>
            </header>
        `;

        if (message.contenido) {
            html += `<p>${escapeHtml(message.contenido)}</p>`;
        }

        html += buildFileAttachmentHtml(message);

        html += `
            <div class="wa-bubble-data"
                data-is-mine="${isMine ? "1" : "0"}"
                data-edit-url="${window.chatConfig.forwardTemplateUrl.replace("0/reenviar/", `${message.id}/editar/`)}"
                data-delete-url="${window.chatConfig.forwardTemplateUrl.replace("0/reenviar/", `${message.id}/eliminar/`)}"
                data-forward-url="${window.chatConfig.forwardTemplateUrl.replace("0", String(message.id))}"></div>
        `;

        article.innerHTML = html;
        const bubbleData = article.querySelector(".wa-bubble-data");
        article.dataset.isMine = bubbleData?.dataset.isMine || "0";
        article.dataset.editUrl = bubbleData?.dataset.editUrl || "";
        article.dataset.deleteUrl = bubbleData?.dataset.deleteUrl || "";
        article.dataset.forwardUrl = bubbleData?.dataset.forwardUrl || "";
        bubbleData?.remove();
        messagesPanel.querySelector(".wa-empty-placeholder")?.remove();
        messagesPanel.appendChild(article);
        updateActiveConversationPreview(message);
        const activeItem = document.querySelector(".wa-chat-item.is-active");
        if (activeItem) {
            updateUnreadBubble(activeItem, { reset: true });
        }
        scrollToBottom();
    };

    const handleSocketMessage = (event) => {
        const payload = JSON.parse(event.data);
        const viewerDirectivaId = Number(window.chatConfig?.directivaId || 0);
        if (viewerDirectivaId && payload.directiva_id && Number(payload.directiva_id) !== viewerDirectivaId) {
            return;
        }
        notifyIncomingPayload(payload, activeChatItem);
        renderMessage(payload);
    };

    const connectRoomSocket = () => {
        if (!window.chatConfig?.socketPath) {
            return;
        }

        if (roomSocket && (roomSocket.readyState === WebSocket.OPEN || roomSocket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        roomSocket = new WebSocket(`${wsProtocol}://${window.location.host}${window.chatConfig.socketPath}`);
        roomSocket.onmessage = handleSocketMessage;
        roomSocket.onopen = () => {
            if (roomSocketReconnectTimer) {
                window.clearTimeout(roomSocketReconnectTimer);
                roomSocketReconnectTimer = null;
            }
            scrollToBottom();
        };
        roomSocket.onclose = () => {
            if (roomSocketReconnectTimer) {
                return;
            }
            roomSocketReconnectTimer = window.setTimeout(() => {
                roomSocketReconnectTimer = null;
                connectRoomSocket();
            }, 1500);
        };
        roomSocket.onerror = () => {
            roomSocket?.close();
        };
    };

    const pollConversationUpdates = async () => {
        if (!window.chatConfig?.updatesUrl || updatesFetchInFlight) {
            return;
        }

        updatesFetchInFlight = true;
        const params = new URLSearchParams({
            last_message_id: String(getLatestRenderedMessageId()),
            last_notice_id: String(getLatestNoticeId("notices")),
            last_assignment_id: String(getLatestNoticeId("assignments")),
        });

        try {
            const response = await fetch(`${window.chatConfig.updatesUrl}?${params.toString()}`, {
                headers: {
                    "X-Requested-With": "XMLHttpRequest",
                },
            });
            if (!response.ok) {
                return;
            }
            const payload = await response.json();
            if (!payload?.ok) {
                return;
            }

            (payload.messages || []).forEach((message) => {
                notifyIncomingPayload(message, activeChatItem);
                renderMessage(message);
            });
            (payload.notices || []).forEach((notice) => {
                notifyIncomingPayload(notice, activeChatItem);
                renderNoticeUpdate(notice);
            });
            (payload.assignments || []).forEach((assignment) => {
                notifyIncomingPayload(assignment, activeChatItem);
                renderNoticeUpdate(assignment);
            });
        } catch {
            // Mantener el fallback silencioso.
        } finally {
            updatesFetchInFlight = false;
        }
    };

    connectRoomSocket();
    pollConversationUpdates();
    updatesPollTimer = window.setInterval(pollConversationUpdates, 1000);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            pollConversationUpdates();
        }
    });

    messagesPanel.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        if (target.closest("a")) {
            return;
        }
        const bubble = target.closest(".wa-bubble[data-message-id]");
        if (!bubble) {
            closeMessageMenu();
            return;
        }
        if (messageSelectionMode) {
            const id = bubble.dataset.messageId;
            if (selectedMessages.has(id)) {
                selectedMessages.delete(id);
                bubble.classList.remove("is-multi-selected");
            } else {
                selectedMessages.add(id);
                bubble.classList.add("is-multi-selected");
            }
            syncSelectionToolbar();
            return;
        }
        openMessageMenu(bubble, event);
    });

    if (attachToggle && attachMenu) {
        attachToggle.addEventListener("click", () => {
            attachMenu.classList.toggle("is-open");
        });
    }

    if (attachFileBtn && fileInput) {
        attachFileBtn.addEventListener("click", () => {
            attachMenu?.classList.remove("is-open");
            fileInput.click();
        });
    }

    if (fileInput && attachInfo) {
        fileInput.addEventListener("change", () => {
            attachInfo.textContent = fileInput.files?.length ? `Adjunto: ${fileInput.files[0].name}` : "";
        });
    }

    document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        if (attachMenu && attachToggle && !attachMenu.contains(target) && !attachToggle.contains(target)) {
            attachMenu.classList.remove("is-open");
        }
    });

    if (messageForm) {
        autoresizeMessageInput();

        messageInput?.addEventListener("input", () => {
            autoresizeMessageInput();
        });

        messageForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const contenido = messageInput.value.trim();
            const hasFile = Boolean(fileInput?.files?.length);
            if (!contenido && !hasFile) {
                return;
            }
            const formData = new FormData();
            formData.append("csrfmiddlewaretoken", window.chatConfig.csrfToken);
            formData.append("contenido", contenido);
            if (window.chatConfig.directivaId) {
                formData.append("directiva_id", window.chatConfig.directivaId);
            }
            if (hasFile && fileInput) {
                formData.append("archivo", fileInput.files[0]);
            }

            const response = await fetch(window.chatConfig.sendUrl, {
                method: "POST",
                body: formData,
                headers: {
                    "X-CSRFToken": formData.get("csrfmiddlewaretoken"),
                },
            });

            if (!response.ok) {
                return;
            }

            const data = await response.json();
            if (data?.ok && data.message) {
                renderMessage(data.message);
            }

            messageInput.value = "";
            autoresizeMessageInput();
            if (fileInput) {
                fileInput.value = "";
            }
            if (attachInfo) {
                attachInfo.textContent = "";
            }
            attachMenu?.classList.remove("is-open");
            messageInput.focus();
        });
    }

    scrollToBottom();

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeDrawers();
            sidePanel?.classList.remove("is-open");
            if (sidePanel) {
                sidePanel.dataset.activePanel = "";
            }
            attachMenu?.classList.remove("is-open");
            closeMessageMenu();
            closeWaModal();
        }
    });

    window.addEventListener("beforeunload", () => {
        if (updatesPollTimer) {
            window.clearInterval(updatesPollTimer);
        }
        if (roomSocketReconnectTimer) {
            window.clearTimeout(roomSocketReconnectTimer);
        }
        roomSocket?.close();
    });

    document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        if (attachMenu && attachToggle && !attachMenu.contains(target) && target !== attachToggle) {
            attachMenu.classList.remove("is-open");
        }
        if (headerChatMenu && headerChatMenuToggle && !headerChatMenu.contains(target) && target !== headerChatMenuToggle) {
            headerChatMenu.classList.remove("is-open");
        }
        if (messageActionMenu && !messageActionMenu.hidden && !messageActionMenu.contains(target) && !target.closest(".wa-bubble[data-message-id]")) {
            closeMessageMenu();
        }
        if (waModal && !waModal.hidden && target.matches("[data-wa-modal-close]")) {
            closeWaModal();
        }
        if (sidePanel && sidePanel.classList.contains("is-open") && !sidePanel.contains(target) && !target.closest("[data-side-panel]")) {
            sidePanel.classList.remove("is-open");
            sidePanel.dataset.activePanel = "";
        }
    });
});
