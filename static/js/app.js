document.addEventListener("DOMContentLoaded", () => {
    const applyViewportHeight = () => {
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        const viewportOffsetTop = window.visualViewport?.offsetTop || 0;
        document.documentElement.style.setProperty("--wa-app-height", `${viewportHeight}px`);
        document.documentElement.style.setProperty("--wa-viewport-offset-top", `${viewportOffsetTop}px`);
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
    const imageInput = document.getElementById("waImageInput");
    const videoInput = document.getElementById("waVideoInput");
    const attachToggle = document.getElementById("attachToggle");
    const attachMenu = document.getElementById("attachMenu");
    const attachFileBtn = document.getElementById("attachFileBtn");
    const attachImageBtn = document.getElementById("attachImageBtn");
    const attachVideoBtn = document.getElementById("attachVideoBtn");
    const attachInfo = document.getElementById("attachInfo");
    const messagesPanel = document.getElementById("messages");
    const headerChatMenuToggle = document.getElementById("headerChatMenuToggle");
    const headerChatMenu = document.getElementById("headerChatMenu");
    const selectionToolbar = document.getElementById("waSelectionToolbar");
    const selectionCount = document.getElementById("waSelectionCount");
    const replyComposer = document.getElementById("replyComposer");
    const replyToInput = document.getElementById("replyToInput");
    const replyComposerAuthor = document.getElementById("replyComposerAuthor");
    const replyComposerText = document.getElementById("replyComposerText");
    const clearReplyButton = document.querySelector("[data-clear-reply]");
    const headerSubtitle = document.getElementById("chatHeaderSubtitle");

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
    let activeAttachmentSource = "file";
    let replyTarget = null;
    let typingStateActive = false;
    let typingIdleTimer = null;
    const typingResetTimers = new Map();
    let swipeState = null;
    let lastDesktopReplyGesture = { messageId: "", at: 0 };

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

    const getMessagePreviewBody = (message) => {
        const body = (message?.contenido || "").trim();
        if (body) {
            return body;
        }
        return (message?.archivo_nombre || "").trim() || "Archivo adjunto";
    };

    const buildReplySnippetHtml = (reply) => {
        if (!reply?.id) {
            return "";
        }

        return `
            <button type="button" class="wa-reply-chip" data-scroll-to-message="${reply.id}">
                <span>${escapeHtml(reply.usuario || "Mensaje")}</span>
                <strong>${escapeHtml(getMessagePreviewBody(reply))}</strong>
            </button>
        `;
    };

    const buildMessageStatusHtml = (message, isMine) => {
        const timeHtml = `<time>${escapeHtml(message.fecha || "--:--")}</time>`;
        return `<div class="wa-bubble-meta wa-bubble-meta--footer">${timeHtml}</div>`;
    };

    const rememberConversationPreview = (item, previewHtml, timeText, lastMessage) => {
        if (!item) {
            return;
        }
        item.dataset.previewHtml = previewHtml;
        item.dataset.previewTime = timeText;
        item.dataset.lastMessage = lastMessage;
    };

    const setChatItemTypingState = (item, active) => {
        if (!item) {
            return;
        }

        const previewNode = item.querySelector(".wa-chat-meta p");
        const timeNode = item.querySelector(".wa-chat-head time");
        if (!previewNode || !timeNode) {
            return;
        }

        if (!item.dataset.previewHtml) {
            rememberConversationPreview(
                item,
                previewNode.innerHTML,
                timeNode.textContent,
                item.dataset.lastMessage || previewNode.textContent.trim().toLowerCase(),
            );
        }

        item.dataset.typing = active ? "1" : "0";
        if (active) {
            previewNode.textContent = "escribiendo...";
            previewNode.classList.add("is-typing");
            return;
        }

        previewNode.innerHTML = item.dataset.previewHtml || "";
        previewNode.classList.remove("is-typing");
        if (item.dataset.previewTime) {
            timeNode.textContent = item.dataset.previewTime;
        }
    };

    const setHeaderTypingState = (active) => {
        if (!headerSubtitle) {
            return;
        }

        if (active) {
            headerSubtitle.textContent = "escribiendo...";
            headerSubtitle.classList.add("is-typing");
            return;
        }

        headerSubtitle.textContent = headerSubtitle.dataset.defaultSubtitle || "";
        headerSubtitle.classList.remove("is-typing");
    };

    const getTypingBubble = () => messagesPanel?.querySelector("[data-typing-indicator='1']");

    const removeTypingBubble = () => {
        getTypingBubble()?.remove();
    };

    const showTypingBubble = (payload) => {
        if (!messagesPanel || Number(payload?.departamento_id || 0) !== getActiveDepartmentId()) {
            return;
        }

        const authorName = (payload?.usuario || payload?.autor_tipo_label || "Contacto").trim();
        let indicator = getTypingBubble();
        if (!indicator) {
            indicator = document.createElement("article");
            indicator.className = "wa-bubble theirs wa-bubble--typing";
            indicator.dataset.typingIndicator = "1";
            indicator.innerHTML = `
                <div class="wa-typing-indicator" aria-live="polite" aria-label="${escapeHtml(authorName)} esta escribiendo">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            `;
            messagesPanel.appendChild(indicator);
        } else {
            indicator.querySelector(".wa-typing-indicator")?.setAttribute("aria-label", `${authorName} esta escribiendo`);
        }

        scrollToBottom();
    };

    const clearTypingForDepartment = (departmentId) => {
        if (!departmentId) {
            return;
        }

        const existingTimer = typingResetTimers.get(departmentId);
        if (existingTimer) {
            window.clearTimeout(existingTimer);
            typingResetTimers.delete(departmentId);
        }

        setChatItemTypingState(document.querySelector(`.wa-chat-item[data-departamento-id="${departmentId}"]`), false);
        if (departmentId === getActiveDepartmentId()) {
            setHeaderTypingState(false);
            removeTypingBubble();
        }
    };

    const scheduleTypingReset = (departmentId) => {
        if (!departmentId) {
            return;
        }

        const existingTimer = typingResetTimers.get(departmentId);
        if (existingTimer) {
            window.clearTimeout(existingTimer);
        }

        typingResetTimers.set(
            departmentId,
            window.setTimeout(() => {
                typingResetTimers.delete(departmentId);
                clearTypingForDepartment(departmentId);
            }, 2400),
        );
    };

    const applyTypingPayload = (payload) => {
        const departmentId = Number(payload?.departamento_id || 0);
        const userId = Number(payload?.user_id || 0);
        if (!departmentId || userId === currentViewerId) {
            return;
        }

        if (payload.typing) {
            setChatItemTypingState(document.querySelector(`.wa-chat-item[data-departamento-id="${departmentId}"]`), true);
            if (departmentId === getActiveDepartmentId()) {
                setHeaderTypingState(true);
                showTypingBubble(payload);
            }
            scheduleTypingReset(departmentId);
            return;
        }

        clearTypingForDepartment(departmentId);
    };

    const applyReadReceipt = () => {};

    const clearReplyTarget = () => {
        replyTarget = null;
        if (replyToInput) {
            replyToInput.value = "";
        }
        if (replyComposer) {
            replyComposer.hidden = true;
            replyComposer.classList.remove("is-mine", "is-theirs");
        }
        document.querySelectorAll(".wa-bubble.is-reply-source").forEach((node) => node.classList.remove("is-reply-source"));
    };

    const setReplyTarget = (reply) => {
        if (!reply?.id) {
            clearReplyTarget();
            return;
        }

        replyTarget = reply;
        if (replyToInput) {
            replyToInput.value = String(reply.id);
        }
        if (replyComposerAuthor) {
            replyComposerAuthor.textContent = reply.usuario || "Mensaje";
        }
        if (replyComposerText) {
            replyComposerText.textContent = getMessagePreviewBody(reply);
        }
        if (replyComposer) {
            replyComposer.hidden = false;
            replyComposer.classList.toggle("is-mine", Boolean(reply.isMine));
            replyComposer.classList.toggle("is-theirs", !reply.isMine);
        }
        document.querySelectorAll(".wa-bubble.is-reply-source").forEach((node) => node.classList.remove("is-reply-source"));
        document.querySelector(`.wa-bubble[data-message-id="${reply.id}"]`)?.classList.add("is-reply-source");
    };

    const getBubbleReplySource = (bubble) => ({
        id: Number(bubble?.dataset.messageId || 0),
        isMine: bubble?.dataset.isMine === "1",
        usuario: bubble?.querySelector("header strong")?.textContent?.trim() || "Mensaje",
        contenido:
            bubble?.querySelector("p")?.textContent?.trim() ||
            bubble?.querySelector(".wa-file-name")?.textContent?.replace(/^📄\s*/, "")?.trim() ||
            "Archivo adjunto",
    });

    const beginReplyFromBubble = (bubble) => {
        if (!bubble) {
            return;
        }

        setReplyTarget(getBubbleReplySource(bubble));
        closeMessageMenu();
        messageInput?.focus();
    };

    const scrollToMessageById = (messageId) => {
        const target = document.querySelector(`.wa-bubble[data-message-id="${messageId}"]`);
        if (!target) {
            return;
        }

        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.remove("is-reply-highlight");
        void target.offsetWidth;
        target.classList.add("is-reply-highlight");
        window.setTimeout(() => target.classList.remove("is-reply-highlight"), 1300);
    };

    const emitTypingState = (active) => {
        if (!window.chatConfig?.socketPath || !roomSocket || roomSocket.readyState !== WebSocket.OPEN) {
            return;
        }
        if (typingStateActive === active) {
            return;
        }

        roomSocket.send(JSON.stringify({ action: "typing", active }));
        typingStateActive = active;
    };

    const scheduleTypingIdleReset = () => {
        if (typingIdleTimer) {
            window.clearTimeout(typingIdleTimer);
        }

        typingIdleTimer = window.setTimeout(() => {
            typingIdleTimer = null;
            emitTypingState(false);
        }, 1200);
    };

    const browserNotificationsSupported = typeof window !== "undefined" && "Notification" in window;
    const serviceWorkerSupported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
    const shownNotificationKeys = new Set();
    const currentViewerId = Number(window.chatConfig?.currentUserId || messagesPanel?.dataset.userId || 0);
    let notificationRegistration = null;

    const setKeyboardOpenState = (open) => {
        document.body.classList.toggle("wa-keyboard-open", open);
    };

    const registerNotificationServiceWorker = async () => {
        if (!serviceWorkerSupported || !window.isSecureContext) {
            return null;
        }

        try {
            notificationRegistration = await navigator.serviceWorker.register("/service-worker.js");
            return notificationRegistration;
        } catch {
            notificationRegistration = null;
            return null;
        }
    };

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

    const suppressInstallPrompt = () => {
        window.addEventListener("beforeinstallprompt", (event) => {
            event.preventDefault();
        });
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
        const targetUrl = getNotificationTargetUrl(payload, item);

        if (payload.kind === "notice") {
            title = payload.emisor || payload.tipo_label || "UNITEF";
            const summary = [payload.tipo_label, payload.titulo].filter(Boolean).join(": ");
            body = payload.contenido || summary || "Nueva actualizacion";
        } else {
            title = payload.usuario || payload.autor_tipo_label || "Nuevo mensaje";
            body = (payload.contenido || "").trim() || (payload.archivo_nombre ? `Archivo: ${payload.archivo_nombre}` : "Nuevo mensaje");
        }

        const options = {
            body,
            icon: window.chatConfig?.notificationIcon,
            badge: window.chatConfig?.notificationIcon,
            timestamp,
            tag: key,
            renotify: false,
            data: { url: targetUrl },
        };

        if (notificationRegistration?.showNotification) {
            void notificationRegistration.showNotification(title, options);
            return;
        }

        const notification = new Notification(title, options);
        notification.onclick = () => {
            window.focus();
            window.location.href = targetUrl;
            notification.close();
        };
    };

    void registerNotificationServiceWorker();
    suppressInstallPrompt();
    scheduleNotificationPermissionPrompt();

    const autoresizeMessageInput = () => {
        if (!messageInput) {
            return;
        }
        messageInput.style.height = "auto";
        const nextHeight = Math.min(messageInput.scrollHeight, 144);
        messageInput.style.height = `${Math.max(nextHeight, 44)}px`;
    };

    const isDesktopViewport = () => window.matchMedia("(min-width: 901px)").matches;

    const getActiveFileInput = () => {
        if (activeAttachmentSource === "image" && imageInput) {
            return imageInput;
        }
        if (activeAttachmentSource === "video" && videoInput) {
            return videoInput;
        }
        return fileInput;
    };

    const clearInactiveFileInputs = () => {
        [fileInput, imageInput, videoInput].forEach((input) => {
            if (input && input !== getActiveFileInput()) {
                input.value = "";
            }
        });
    };

    const updateAttachInfo = () => {
        const input = getActiveFileInput();
        if (!attachInfo) {
            return;
        }
        attachInfo.textContent = input?.files?.length ? `Archivo: ${input.files[0].name}` : "";
    };

    const selectAttachmentSource = (source) => {
        activeAttachmentSource = source;
        clearInactiveFileInputs();
        updateAttachInfo();
    };

    const isImageFile = (name) => /\.(png|jpe?g|gif|webp|bmp|svg|heic)$/i.test(name || "");
    const isVideoFile = (name) => /\.(mp4|webm|mov|m4v|avi|mkv|3gp)$/i.test(name || "");

    const buildMediaPreviewHtml = (message) => {
        if (!message.archivo_url || (!message.archivo_es_imagen && !message.archivo_es_video)) {
            return "";
        }

        const mediaKind = message.archivo_es_video ? "video" : "image";
        const mediaNode = message.archivo_es_video
            ? `
                <video preload="metadata" muted playsinline>
                    <source src="${message.archivo_abrir_url || message.archivo_url}">
                </video>
                <span class="wa-media-play">▶</span>
            `
            : `<img src="${message.archivo_abrir_url || message.archivo_url}" alt="${escapeHtml(message.archivo_nombre || "Adjunto")}">`;

        return `
            <button
                type="button"
                class="wa-media-preview"
                data-media-action
                data-media-kind="${mediaKind}"
                data-media-open-url="${message.archivo_abrir_url || message.archivo_url}"
                data-media-download-url="${message.archivo_descargar_url || message.archivo_url}"
                data-media-name="${escapeHtml(message.archivo_nombre || "Adjunto")}">
                ${mediaNode}
            </button>
        `;
    };

    const buildFileAttachmentHtml = (message) => {
        if (!message.archivo_url) {
            return "";
        }

        const openUrl = message.archivo_abrir_url || message.archivo_url;
        const downloadUrl = message.archivo_descargar_url || message.archivo_url;
        return `
            <div class="wa-file-card${message.archivo_es_imagen || message.archivo_es_video ? " is-media" : ""}">
                ${buildMediaPreviewHtml(message)}
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

    const payloadIsFromCurrentViewer = (payload) => Number(payload?.usuario_id || 0) === currentViewerId;

    const shouldIncrementUnreadForPayload = (payload) =>
        payload?.kind === "message" &&
        payload?.action !== "deleted" &&
        !payload?.es_sistema &&
        !payloadIsFromCurrentViewer(payload);

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
            const previewHtml = `<span class="wa-last-author">${label}:</span> ${escapeHtml(body)}`;
            previewNode.innerHTML = previewHtml;
            timeNode.textContent = "Ahora";
            rememberConversationPreview(item, previewHtml, "Ahora", body.toLowerCase());
            return;
        }

        const body = (payload.contenido || "").trim() || (payload.archivo_nombre ? "Archivo adjunto" : "Mensaje");
        const author = payload.autor_tipo_label || "Contacto";
        const previewHtml = `<span class="wa-last-author">${escapeHtml(author)}:</span> ${escapeHtml(body)}`;
        previewNode.innerHTML = previewHtml;
        timeNode.textContent = payload.fecha || "--:--";
        rememberConversationPreview(item, previewHtml, payload.fecha || "--:--", body.toLowerCase());
    };

    const moveConversationItemToTop = (item, payload) => {
        if (!item || !payload || payload.action === "deleted") {
            return;
        }

        const list = item.parentElement;
        if (!list) {
            return;
        }

        item.dataset.lastTimestamp = String(Number(payload.timestamp || Date.now()));
        const items = Array.from(list.querySelectorAll(".wa-chat-item"));
        const beforePositions = new Map(
            items.map((chatItem) => [chatItem, chatItem.getBoundingClientRect()]),
        );
        const sortedItems = [...items].sort(
            (a, b) => Number(b.dataset.lastTimestamp || 0) - Number(a.dataset.lastTimestamp || 0),
        );

        sortedItems.forEach((chatItem) => list.appendChild(chatItem));

        sortedItems.forEach((chatItem) => {
            const previousRect = beforePositions.get(chatItem);
            if (!previousRect) {
                return;
            }
            const nextRect = chatItem.getBoundingClientRect();
            const deltaY = previousRect.top - nextRect.top;
            if (Math.abs(deltaY) < 1 || typeof chatItem.animate !== "function") {
                return;
            }
            chatItem.animate(
                [
                    { transform: `translateY(${deltaY}px)` },
                    { transform: "translateY(0)" },
                ],
                {
                    duration: 260,
                    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                },
            );
        });

        item.classList.remove("is-activity-bump");
        void item.offsetWidth;
        item.classList.add("is-activity-bump");
        window.setTimeout(() => item.classList.remove("is-activity-bump"), 320);
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
    chatItems.forEach((item) => {
        const previewNode = item.querySelector(".wa-chat-meta p");
        const timeNode = item.querySelector(".wa-chat-head time");
        if (!previewNode || !timeNode) {
            return;
        }
        rememberConversationPreview(
            item,
            previewNode.innerHTML,
            timeNode.textContent,
            item.dataset.lastMessage || previewNode.textContent.trim().toLowerCase(),
        );
    });
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
        const sidebarSocketReconnectTimers = new Map();
        const sidebarSockets = new Map();
        let sidebarSocketsShuttingDown = false;

        const scheduleSidebarReconnect = (departamentoId, item) => {
            if (sidebarSocketsShuttingDown) {
                return;
            }
            if (sidebarSocketReconnectTimers.has(departamentoId)) {
                return;
            }
            const timer = window.setTimeout(() => {
                sidebarSocketReconnectTimers.delete(departamentoId);
                connectConversationPreviewSocket(item, departamentoId);
            }, 1500);
            sidebarSocketReconnectTimers.set(departamentoId, timer);
        };

        const connectConversationPreviewSocket = (item, departamentoId) => {
            const currentSocket = sidebarSockets.get(departamentoId);
            if (currentSocket && (currentSocket.readyState === WebSocket.OPEN || currentSocket.readyState === WebSocket.CONNECTING)) {
                return;
            }

            const socket = new WebSocket(
                `${wsProtocolSidebar}://${window.location.host}/ws/chat/departamento/${departamentoId}/`,
            );
            sidebarSockets.set(departamentoId, socket);

            socket.onmessage = (event) => {
                const payload = JSON.parse(event.data);
                const viewerDirectivaId = Number(window.chatConfig?.directivaId || 0);
                if (viewerDirectivaId && payload.directiva_id && Number(payload.directiva_id) !== viewerDirectivaId) {
                    return;
                }
                if (payload.kind === "typing") {
                    applyTypingPayload(payload);
                    return;
                }
                if (payload.kind === "read_receipt") {
                    applyReadReceipt(payload);
                    return;
                }
                clearTypingForDepartment(departamentoId);
                updateConversationPreviewForItem(item, payload);
                moveConversationItemToTop(item, payload);
                if (shouldIncrementUnreadForPayload(payload)) {
                    updateUnreadBubble(item, { increment: 1 });
                }
                notifyIncomingPayload(payload, item);
                runChatFilters();
            };
            socket.onclose = () => {
                if (sidebarSockets.get(departamentoId) === socket) {
                    sidebarSockets.delete(departamentoId);
                }
                scheduleSidebarReconnect(departamentoId, item);
            };
            socket.onerror = () => {
                socket.close();
            };
        };

        chatItems.forEach((item) => {
            const departamentoId = getDepartmentIdFromChatItem(item);
            if (!departamentoId) {
                return;
            }
            if (activeDepartmentId && departamentoId === activeDepartmentId) {
                return;
            }
            connectConversationPreviewSocket(item, departamentoId);
        });

        window.addEventListener("beforeunload", () => {
            sidebarSocketsShuttingDown = true;
            sidebarSocketReconnectTimers.forEach((timer) => window.clearTimeout(timer));
            sidebarSockets.forEach((socket) => socket.close());
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
        const saveButton = messageActionMenu.querySelector("[data-menu-action='save']");
        if (editButton) {
            editButton.hidden = !isMine;
        }
        if (saveButton) {
            saveButton.hidden = !bubble.querySelector(".wa-file-link[href]");
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

    const runBubbleSave = (bubble) => {
        const saveLink = bubble.querySelector(".wa-file-link[href]");
        if (!saveLink) {
            return;
        }
        window.open(saveLink.href, "_blank", "noopener");
    };

    clearReplyButton?.addEventListener("click", () => {
        clearReplyTarget();
        messageInput?.focus();
    });

    const runMediaActionMenu = (bubble) => {
        const mediaTrigger = bubble.querySelector("[data-media-action]");
        if (!(mediaTrigger instanceof HTMLElement)) {
            return;
        }

        const isMine = bubble.dataset.isMine === "1";
        openWaModal({
            title: mediaTrigger.dataset.mediaKind === "video" ? "Video" : "Imagen",
            body: `<p>${escapeHtml(mediaTrigger.dataset.mediaName || "Adjunto")}</p>`,
            actions: [
                {
                    label: "Guardar",
                    onClick: () => {
                        window.open(mediaTrigger.dataset.mediaDownloadUrl || mediaTrigger.dataset.mediaOpenUrl || "", "_blank", "noopener");
                    },
                },
                {
                    label: "Reenviar",
                    onClick: () => {
                        closeWaModal();
                        runBubbleForward(bubble);
                    },
                },
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
                ...(isMine
                    ? [
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
                    ]
                    : []),
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

            if (action === "reply") {
                beginReplyFromBubble(selectedBubble);
                closeMessageMenu();
                return;
            }

            if (action === "edit" && isMine) {
                runBubbleEdit(selectedBubble);
                closeMessageMenu();
                return;
            }

            if (action === "save") {
                runBubbleSave(selectedBubble);
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
    let chatReadSyncTimer = null;
    let chatReadSyncInFlight = false;
    let chatReadSyncQueued = false;
    const renderedIds = new Set(
        Array.from(messagesPanel.querySelectorAll("[data-message-id]"))
            .map((node) => Number(node.dataset.messageId))
            .filter((value) => Number.isFinite(value) && value > 0),
    );

    const scrollToBottom = () => {
        messagesPanel.scrollTop = messagesPanel.scrollHeight;
    };

    const shouldAutoMarkCurrentChatAsRead = () =>
        Boolean(window.chatConfig?.markChatReadUrl) && !document.hidden && document.hasFocus();

    const syncCurrentChatAsRead = async () => {
        if (!window.chatConfig?.markChatReadUrl || !shouldAutoMarkCurrentChatAsRead()) {
            return;
        }

        if (chatReadSyncInFlight) {
            chatReadSyncQueued = true;
            return;
        }

        chatReadSyncInFlight = true;
        try {
            const formData = new FormData();
            formData.append("csrfmiddlewaretoken", window.chatConfig.csrfToken || getCsrfToken());
            const response = await fetch(window.chatConfig.markChatReadUrl, {
                method: "POST",
                body: formData,
                headers: {
                    "X-CSRFToken": formData.get("csrfmiddlewaretoken"),
                },
            });
            if (response.ok) {
                const activeItem = document.querySelector(".wa-chat-item.is-active");
                if (activeItem) {
                    updateUnreadBubble(activeItem, { reset: true });
                    runChatFilters();
                }
            }
        } catch {
            // Mantener la sincronizacion silenciosa.
        } finally {
            chatReadSyncInFlight = false;
            if (chatReadSyncQueued) {
                chatReadSyncQueued = false;
                scheduleCurrentChatReadSync();
            }
        }
    };

    const scheduleCurrentChatReadSync = (delay = 180) => {
        if (!window.chatConfig?.markChatReadUrl) {
            return;
        }
        if (chatReadSyncTimer) {
            window.clearTimeout(chatReadSyncTimer);
        }
        chatReadSyncTimer = window.setTimeout(() => {
            chatReadSyncTimer = null;
            void syncCurrentChatAsRead();
        }, delay);
    };

    const renderNoticeUpdate = (message) => {
        const panelName = message.tipo === "asignacion" ? "assignments" : "notices";
        const activeItem = document.querySelector(".wa-chat-item.is-active");
        const buildNoticeAttachmentHtml = (notice) => {
            if (!notice.archivo_url) {
                return "";
            }

            const previewHtml = (notice.archivo_es_imagen || notice.archivo_es_video)
                ? `
                    <a class="wa-media-preview" href="${notice.archivo_abrir_url || notice.archivo_url}" target="_blank" rel="noopener">
                        ${notice.archivo_es_video
                            ? `<video preload="metadata" muted playsinline><source src="${notice.archivo_abrir_url || notice.archivo_url}"></video><span class="wa-media-play">▶</span>`
                            : `<img src="${notice.archivo_abrir_url || notice.archivo_url}" alt="${escapeHtml(notice.archivo_nombre || "Adjunto")}">`}
                    </a>
                `
                : "";

            return `
                <div class="wa-file-card${notice.archivo_es_imagen || notice.archivo_es_video ? " is-media" : ""}">
                    ${previewHtml}
                    <div class="wa-file-name">📄 ${escapeHtml(notice.archivo_nombre || "Adjunto")}</div>
                    <div class="wa-file-actions">
                        <a class="wa-file-link" href="${notice.archivo_abrir_url || notice.archivo_url}" target="_blank" rel="noopener">Ver</a>
                        <a class="wa-file-link" href="${notice.archivo_descargar_url || notice.archivo_url}">Descargar</a>
                    </div>
                </div>
            `;
        };

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
            existingNote.querySelector(".wa-file-card")?.remove();
            if (message.archivo_url) {
                existingNote.insertAdjacentHTML("beforeend", buildNoticeAttachmentHtml(message));
            }
            existingNote.dataset.panelKind = panelName;
            if (activeItem) {
                updateActiveConversationPreview(message);
                moveConversationItemToTop(activeItem, message);
                runChatFilters();
            }
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
                    note.querySelector(".wa-file-card")?.remove();
                    if (message.archivo_url) {
                        note.insertAdjacentHTML("beforeend", buildNoticeAttachmentHtml(message));
                    }
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
            ${buildNoticeAttachmentHtml(message)}
        `;
        target.prepend(article);

        if (activeItem) {
            updateActiveConversationPreview(message);
            moveConversationItemToTop(activeItem, message);
            runChatFilters();
        }

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
        const previewHtml = `<span class="wa-last-author">${escapeHtml(author)}:</span> ${escapeHtml(body)}`;
        previewNode.innerHTML = previewHtml;
        timeNode.textContent = message.fecha || "--:--";
        rememberConversationPreview(activeItem, previewHtml, message.fecha || "--:--", body.toLowerCase());
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
        article.dataset.isMine = isMine ? "1" : "0";
        article.dataset.editUrl = window.chatConfig.forwardTemplateUrl.replace("0/reenviar/", `${message.id}/editar/`);
        article.dataset.deleteUrl = window.chatConfig.forwardTemplateUrl.replace("0/reenviar/", `${message.id}/eliminar/`);
        article.dataset.forwardUrl = window.chatConfig.forwardTemplateUrl.replace("0", String(message.id));

        let html = `
            <header>
                <strong>${escapeHtml(message.usuario)}</strong>
            </header>
        `;

        html += buildReplySnippetHtml(message.responde_a);

        if (message.contenido) {
            html += `<p>${escapeHtml(message.contenido)}</p>`;
        }

        html += buildFileAttachmentHtml(message);
        html += buildMessageStatusHtml(message, isMine);

        article.innerHTML = html;
        messagesPanel.querySelector(".wa-empty-placeholder")?.remove();
        messagesPanel.appendChild(article);
        clearTypingForDepartment(Number(message.departamento_id || getActiveDepartmentId()));
        updateActiveConversationPreview(message);
        const activeItem = document.querySelector(".wa-chat-item.is-active");
        if (activeItem) {
            updateUnreadBubble(activeItem, { reset: true });
            moveConversationItemToTop(activeItem, message);
        }
        if (!isMine && shouldAutoMarkCurrentChatAsRead()) {
            scheduleCurrentChatReadSync();
        }
        scrollToBottom();
    };

    const handleSocketMessage = (event) => {
        const payload = JSON.parse(event.data);
        const viewerDirectivaId = Number(window.chatConfig?.directivaId || 0);
        if (viewerDirectivaId && payload.directiva_id && Number(payload.directiva_id) !== viewerDirectivaId) {
            return;
        }
        if (payload.kind === "typing") {
            applyTypingPayload(payload);
            return;
        }
        if (payload.kind === "read_receipt") {
            applyReadReceipt(payload);
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
            scheduleCurrentChatReadSync(0);
            if (messageInput?.value.trim()) {
                emitTypingState(true);
                scheduleTypingIdleReset();
            }
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
            scheduleCurrentChatReadSync(0);
            pollConversationUpdates();
        }
    });
    window.addEventListener("focus", () => {
        scheduleCurrentChatReadSync(0);
    });

    messagesPanel.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        const replyTrigger = target.closest("[data-scroll-to-message]");
        if (replyTrigger instanceof HTMLElement) {
            scrollToMessageById(Number(replyTrigger.dataset.scrollToMessage || 0));
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
        if (target.closest("[data-media-action]")) {
            runMediaActionMenu(bubble);
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

    messagesPanel.addEventListener("contextmenu", (event) => {
        if (!isDesktopViewport()) {
            return;
        }

        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const bubble = target.closest(".wa-bubble[data-message-id]");
        if (!bubble) {
            return;
        }

        event.preventDefault();
        const messageId = bubble.dataset.messageId || "";
        const now = Date.now();
        if (lastDesktopReplyGesture.messageId === messageId && now - lastDesktopReplyGesture.at < 450) {
            lastDesktopReplyGesture = { messageId: "", at: 0 };
            beginReplyFromBubble(bubble);
            return;
        }

        lastDesktopReplyGesture = { messageId, at: now };
    });

    messagesPanel.addEventListener("pointerdown", (event) => {
        if (isDesktopViewport() || event.pointerType === "mouse" || messageSelectionMode) {
            return;
        }

        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const bubble = target.closest(".wa-bubble[data-message-id]");
        if (!bubble) {
            return;
        }

        swipeState = {
            bubble,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            deltaX: 0,
            dragging: false,
        };
    });

    messagesPanel.addEventListener("pointermove", (event) => {
        if (!swipeState || swipeState.pointerId !== event.pointerId) {
            return;
        }

        const deltaX = Math.max(0, event.clientX - swipeState.startX);
        const deltaY = Math.abs(event.clientY - swipeState.startY);
        if (deltaY > 34 && deltaY > deltaX) {
            swipeState = null;
            return;
        }

        swipeState.deltaX = Math.min(deltaX, 82);
        swipeState.dragging = swipeState.deltaX > 16;
        swipeState.bubble.classList.add("is-reply-dragging");
        swipeState.bubble.style.transform = `translateX(${swipeState.deltaX}px)`;
        swipeState.bubble.classList.toggle("is-reply-ready", swipeState.deltaX >= 58);
    });

    const finishSwipeReply = (pointerId) => {
        if (!swipeState || swipeState.pointerId !== pointerId) {
            return;
        }

        const { bubble, deltaX } = swipeState;
        bubble.style.transform = "";
        bubble.classList.remove("is-reply-dragging", "is-reply-ready");
        if (deltaX >= 58) {
            beginReplyFromBubble(bubble);
        }
        swipeState = null;
    };

    messagesPanel.addEventListener("pointerup", (event) => {
        finishSwipeReply(event.pointerId);
    });

    messagesPanel.addEventListener("pointercancel", (event) => {
        finishSwipeReply(event.pointerId);
    });

    if (attachToggle && attachMenu) {
        attachToggle.addEventListener("click", () => {
            attachMenu.classList.toggle("is-open");
        });
    }

    if (attachFileBtn && fileInput) {
        attachFileBtn.addEventListener("click", () => {
            selectAttachmentSource("file");
            attachMenu?.classList.remove("is-open");
            fileInput.click();
        });
    }

    if (attachImageBtn && imageInput) {
        attachImageBtn.addEventListener("click", () => {
            selectAttachmentSource("image");
            attachMenu?.classList.remove("is-open");
            imageInput.click();
        });
    }

    if (attachVideoBtn && videoInput) {
        attachVideoBtn.addEventListener("click", () => {
            selectAttachmentSource("video");
            attachMenu?.classList.remove("is-open");
            videoInput.click();
        });
    }

    [fileInput, imageInput, videoInput].forEach((input) => {
        if (!input) {
            return;
        }
        input.addEventListener("change", () => {
            if (input === imageInput) {
                selectAttachmentSource("image");
            } else if (input === videoInput) {
                selectAttachmentSource("video");
            } else {
                selectAttachmentSource("file");
            }
            updateAttachInfo();
        });
    });

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

        messageInput?.addEventListener("focus", () => {
            setKeyboardOpenState(true);
            applyViewportHeight();
            if (messageInput.value.trim()) {
                emitTypingState(true);
                scheduleTypingIdleReset();
            }
        });

        messageInput?.addEventListener("blur", () => {
            emitTypingState(false);
            window.setTimeout(() => {
                setKeyboardOpenState(false);
                applyViewportHeight();
            }, 120);
        });

        messageInput?.addEventListener("input", () => {
            autoresizeMessageInput();
            if (messageInput.value.trim()) {
                emitTypingState(true);
                scheduleTypingIdleReset();
                return;
            }

            if (typingIdleTimer) {
                window.clearTimeout(typingIdleTimer);
                typingIdleTimer = null;
            }
            emitTypingState(false);
        });

        messageInput?.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" || event.shiftKey) {
                return;
            }
            if (!isDesktopViewport()) {
                return;
            }
            event.preventDefault();
            messageForm.requestSubmit();
        });

        messageForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const contenido = messageInput.value.trim();
            const activeFileInput = getActiveFileInput();
            const hasFile = Boolean(activeFileInput?.files?.length);
            if (!contenido && !hasFile) {
                return;
            }
            const formData = new FormData();
            formData.append("csrfmiddlewaretoken", window.chatConfig.csrfToken);
            formData.append("contenido", contenido);
            if (window.chatConfig.directivaId) {
                formData.append("directiva_id", window.chatConfig.directivaId);
            }
            if (replyTarget?.id) {
                formData.append("responde_a_id", String(replyTarget.id));
            }
            if (hasFile && activeFileInput) {
                formData.append("archivo", activeFileInput.files[0]);
            }

            emitTypingState(false);

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
            [fileInput, imageInput, videoInput].forEach((input) => {
                if (input) {
                    input.value = "";
                }
            });
            clearReplyTarget();
            activeAttachmentSource = "file";
            updateAttachInfo();
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
            clearReplyTarget();
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
        if (chatReadSyncTimer) {
            window.clearTimeout(chatReadSyncTimer);
        }
        if (typingIdleTimer) {
            window.clearTimeout(typingIdleTimer);
        }
        emitTypingState(false);
        typingResetTimers.forEach((timer) => window.clearTimeout(timer));
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
