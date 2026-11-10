import {
	App,
	MarkdownView,
	Notice,
	Platform,
	Plugin,
	PluginSettingTab,
	Setting,
	setIcon,
} from "obsidian";
import { getTranslations, isOmawriteTextAlignment } from "./i18n";
import type { OmawriteTextAlignment, OmawriteTranslations, PluginLocale } from "./i18n";

interface OmawriteSettings {
	settingsVersion: number;
	fontSize: number;
	lineWidth: number;
	topSpacing: number;
	textAlignment: OmawriteTextAlignment;
	backgroundImagePath: string;
	backgroundOpacity: number;
	notificationsEnabled: boolean;
}

const SETTINGS_VERSION = 6;

const DEFAULT_SETTINGS: OmawriteSettings = {
	settingsVersion: SETTINGS_VERSION,
	fontSize: 20,
	lineWidth: 80,
	topSpacing: 5,
	textAlignment: "left",
	backgroundImagePath: "",
	backgroundOpacity: 18,
	notificationsEnabled: true,
};

const OMAWRITE_CLASS = "omawrite-mode";
const OMAWRITE_BACKGROUND_CLASS = "omawrite-background-layer";
const OMAWRITE_DISTRACTION_FREE_CLASS = "omawrite-distraction-free";
const OMAWRITE_TOP_CORNER_CLASS = "omawrite-top-corner-visible";
const OMAWRITE_BOTTOM_CORNER_CLASS = "omawrite-bottom-corner-visible";
const TOGGLE_COMMAND_ID = "toggle-current-note";
const TOGGLE_FULLSCREEN_COMMAND_ID = "toggle-current-note-fullscreen";

const DEFAULT_TOGGLE_HOTKEYS: OmawriteHotkey[] = [
	{ modifiers: ["Mod", "Shift"], key: "o" },
];

const DEFAULT_TOGGLE_FULLSCREEN_HOTKEYS: OmawriteHotkey[] = [
	{ modifiers: ["Mod", "Shift", "Alt"], key: "o" },
];

export default class OmawritePlugin extends Plugin {
	settings: OmawriteSettings = { ...DEFAULT_SETTINGS };
	readonly translations: OmawriteTranslations = getTranslations();
	private activeNotePaths = new Set<string>();
	private exitButton: HTMLButtonElement | null = null;
	private fullscreenButton: HTMLButtonElement | null = null;
	private wordCountElement: HTMLDivElement | null = null;
	private backgroundImageCachePath = "";
	private backgroundImageCache: string | null = null;
	private backgroundImageLoadingPath = "";
	private settingsSaveChain: Promise<void> = Promise.resolve();
	private pointerX = -1;
	private pointerY = -1;
	private managedFullscreenChanges = 0;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addCommand({
			id: TOGGLE_COMMAND_ID,
			name: this.translations.commandToggle,
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "o" }],
			callback: () => {
				void this.toggleCurrentNote();
			},
		});

		this.addCommand({
			id: TOGGLE_FULLSCREEN_COMMAND_ID,
			name: this.translations.commandToggleFullscreen,
			hotkeys: [{ modifiers: ["Mod", "Shift", "Alt"], key: "o" }],
			callback: () => {
				void this.toggleOmawriteFullscreen();
			},
		});

		this.addCommand({
			id: "enable-current-note",
			name: this.translations.commandEnable,
			callback: () => {
				void this.setCurrentNoteEnabled(true);
			},
		});

		this.addCommand({
			id: "disable-current-note",
			name: this.translations.commandDisable,
			callback: () => {
				void this.setCurrentNoteEnabled(false);
			},
		});

		this.addRibbonIcon("pencil", this.translations.ribbonToggle, () => {
			void this.toggleCurrentNote();
		});
		this.createExitButton();
		this.createFullscreenButton();
		this.createWordCountIndicator();
		this.registerDomEvent(document, "mousemove", (event) => {
			this.pointerX = event.clientX;
			this.pointerY = event.clientY;
			this.updateCornerVisibility(event.clientX, event.clientY);
		});
		// Escape is handled only while Omawrite's distraction-free shell is
		// active. It exits Omawrite mode; fullscreen has its own button and
		// configurable shortcut. Outside Omawrite this listener is a no-op.
		this.registerDomEvent(
			document,
			"keydown",
			(event) => {
				if (
					event.key !== "Escape" ||
					!document.body.classList.contains(OMAWRITE_DISTRACTION_FREE_CLASS)
				) {
					return;
				}

				event.preventDefault();
				event.stopPropagation();
				void this.setCurrentNoteEnabled(false);
			},
			true,
		);
		this.registerDomEvent(window, "blur", () => this.updateCornerVisibility(-1, -1));
		this.registerDomEvent(document, "fullscreenchange", () => this.handleFullscreenChange());

		this.addSettingTab(new OmawriteSettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => this.refreshViews()),
		);
		this.registerEvent(
			this.app.workspace.on("file-open", () => this.refreshViews()),
		);
		this.registerEvent(
			this.app.workspace.on("layout-change", () => this.refreshViews()),
		);
		this.registerEvent(
			this.app.workspace.on("editor-change", () => this.updateWordCount()),
		);
		this.app.workspace.onLayoutReady(() => this.refreshViews());
	}

	onunload(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				this.setViewMode(leaf.view, false);
			}
		});
		this.setDistractionFree(false);
		this.exitButton?.remove();
		this.exitButton = null;
		this.fullscreenButton?.remove();
		this.fullscreenButton = null;
		this.wordCountElement?.remove();
		this.wordCountElement = null;
		this.clearBackgroundImageCache();
		this.activeNotePaths.clear();
		if (document.fullscreenElement) {
			void document.exitFullscreen().catch(() => undefined);
		}
	}

	async loadSettings(): Promise<void> {
		let stored: Partial<OmawriteSettings> | null = null;
		try {
			stored = (await this.loadData()) as Partial<OmawriteSettings> | null;
		} catch {
			// A previous interrupted write can leave an empty data.json. Treat it
			// as first-run settings instead of preventing the plugin from loading.
			stored = null;
		}
		const migrateLegacyWidth = stored?.settingsVersion === undefined && stored?.lineWidth === 65;

		this.settings = {
			settingsVersion: SETTINGS_VERSION,
			fontSize: this.clampNumber(stored?.fontSize, 14, 32, DEFAULT_SETTINGS.fontSize),
			lineWidth: migrateLegacyWidth
				? DEFAULT_SETTINGS.lineWidth
				: this.clampNumber(stored?.lineWidth, 45, 150, DEFAULT_SETTINGS.lineWidth),
			topSpacing: this.clampNumber(stored?.topSpacing, 0, 15, DEFAULT_SETTINGS.topSpacing),
			textAlignment: this.normalizeTextAlignment(stored?.textAlignment),
			backgroundImagePath:
				typeof stored?.backgroundImagePath === "string"
					? stored.backgroundImagePath
					: DEFAULT_SETTINGS.backgroundImagePath,
			backgroundOpacity: this.clampNumber(
				stored?.backgroundOpacity,
				0,
				100,
				DEFAULT_SETTINGS.backgroundOpacity,
			),
			notificationsEnabled:
				typeof stored?.notificationsEnabled === "boolean"
					? stored.notificationsEnabled
					: DEFAULT_SETTINGS.notificationsEnabled,
		};

		if (stored?.settingsVersion !== SETTINGS_VERSION) {
			try {
				await this.saveSettings();
			} catch {
				// Settings remain usable even if the host temporarily blocks writes.
			}
		}
	}

	async saveSettings(): Promise<void> {
		const snapshot = { ...this.settings };
		this.settingsSaveChain = this.settingsSaveChain
			.catch(() => undefined)
			.then(() => this.writeSettingsSnapshot(snapshot));
		await this.settingsSaveChain;
	}

	notify(message: string): void {
		if (this.settings.notificationsEnabled) new Notice(message);
	}

	private async writeSettingsSnapshot(snapshot: OmawriteSettings): Promise<void> {
		const adapter = this.app.vault.adapter as VaultAdapterWithFullPath;
		const relativePath = `${this.app.vault.configDir}/plugins/${this.manifest.id}/data.json`;
		const data = JSON.stringify(snapshot, null, 2);

		// Obsidian's adapter is the safest writer for plugin data: it knows the
		// vault's actual filesystem root and avoids renderer/native-module races.
		// Keep this outside the file-picker event; callers schedule saveSettings on
		// the next task so the dialog and Settings window stay responsive.
		if (adapter.write) {
			await adapter.write(relativePath, data);
			return;
		}

		const fileSystem = loadNodeModule("fs") as NodeFileSystem | null;
		const fullPath =
			adapter.getFullPath?.(relativePath) ??
			(adapter.getBasePath?.()
				? `${adapter.getBasePath?.()}\\${relativePath.replace(/\//g, "\\")}`
				: null);

		if (fileSystem?.promises?.writeFile && fullPath) {
			await fileSystem.promises.writeFile(fullPath, data, "utf8");
			return;
		}

		// Keep Obsidian's adapter as a compatibility fallback for environments
		// where the native filesystem path is not exposed.
		await this.saveData(snapshot);
	}

	private clampNumber(
		value: unknown,
		minimum: number,
		maximum: number,
		fallback: number,
	): number {
		if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
		return Math.min(maximum, Math.max(minimum, value));
	}

	normalizeTextAlignment(value: unknown): OmawriteTextAlignment {
		return isOmawriteTextAlignment(value)
			? value
			: DEFAULT_SETTINGS.textAlignment;
	}

	private getActiveMarkdownView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}

	private getViewDocument(view: MarkdownView | null): Document {
		return view?.containerEl.ownerDocument ?? document;
	}

	getActivationHotkeyDescription(): string {
		const normalHotkeys = this.getConfiguredHotkeys(
			TOGGLE_COMMAND_ID,
			DEFAULT_TOGGLE_HOTKEYS,
		);
		const fullscreenHotkeys = this.getConfiguredHotkeys(
			TOGGLE_FULLSCREEN_COMMAND_ID,
			DEFAULT_TOGGLE_FULLSCREEN_HOTKEYS,
		);

		return this.translations.hotkeyDescription(
			formatHotkeys(normalHotkeys, Platform.isMacOS, this.translations),
			formatHotkeys(fullscreenHotkeys, Platform.isMacOS, this.translations),
		);
	}

	private getConfiguredHotkeys(
		commandId: string,
		fallback: OmawriteHotkey[],
	): OmawriteHotkey[] {
		const appWithCommands = this.app as AppWithInternalCommands;
		const commandKey = `${this.manifest.id}:${commandId}`;
		const configured = appWithCommands.commands?.commands?.[commandKey]?.hotkeys;
		return Array.isArray(configured) ? configured : fallback;
	}

	private isEnabled(path: string): boolean {
		return this.activeNotePaths.has(path);
	}

	private createExitButton(): void {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "omawrite-exit-button";
		button.setAttribute("aria-label", this.translations.exitMode);
		button.setAttribute("title", this.translations.exitMode);
		setIcon(button, "minimize-2");
		document.body.appendChild(button);
		this.exitButton = button;
		this.registerDomEvent(button, "click", () => {
			void this.setCurrentNoteEnabled(false);
		});
	}

	private createFullscreenButton(): void {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "omawrite-fullscreen-button";
		button.setAttribute("aria-label", this.translations.enterFullscreen);
		button.setAttribute("title", this.translations.enterFullscreen);
		setIcon(button, "maximize-2");
		document.body.appendChild(button);
		this.fullscreenButton = button;
		this.registerDomEvent(button, "click", () => {
			void this.toggleFullscreen();
		});
		this.updateFullscreenButton();
	}

	private createWordCountIndicator(): void {
		const indicator = document.createElement("div");
		indicator.className = "omawrite-word-count";
		indicator.setAttribute("aria-live", "polite");
		indicator.setAttribute("aria-atomic", "true");
		document.body.appendChild(indicator);
		this.wordCountElement = indicator;
		this.updateWordCount();
	}

	private updateWordCount(): void {
		if (!this.wordCountElement) return;

		const view = this.getActiveMarkdownView();
		const enabled = Boolean(view?.file && this.isEnabled(view.file.path));
		this.wordCountElement.classList.toggle("is-visible", enabled);
		if (!enabled || !view) {
			this.wordCountElement.textContent = "";
			return;
		}

		const statistics = getTextStatistics(view.editor.getValue(), this.translations.locale);
		const numberFormat = new Intl.NumberFormat(this.translations.locale);
		this.wordCountElement.textContent = this.translations.wordCount(
			numberFormat.format(statistics.words),
			numberFormat.format(statistics.characters),
		);
	}

	private async toggleOmawriteFullscreen(): Promise<void> {
		const view = this.getActiveMarkdownView();
		if (!view?.file) {
			this.notify(this.translations.openNoteFirst);
			return;
		}

		const targetDocument = this.getViewDocument(view);
		const enabled = this.isEnabled(view.file.path);

		if (!enabled) {
			await this.setCurrentNoteEnabled(true);
			if (!targetDocument.fullscreenElement) await this.toggleFullscreen(targetDocument);
			return;
		}

		await this.toggleFullscreen(targetDocument);
	}

	private updateCornerVisibility(
		clientX: number,
		clientY: number,
		targetDocument: Document = document,
	): void {
		const targetWindow = targetDocument.defaultView ?? window;
		if (!targetDocument.body.classList.contains(OMAWRITE_DISTRACTION_FREE_CLASS)) {
			targetDocument.body.classList.remove(OMAWRITE_TOP_CORNER_CLASS, OMAWRITE_BOTTOM_CORNER_CLASS);
			return;
		}

		const zone = Math.max(96, Math.min(180, Math.round(targetWindow.innerWidth * 0.12)));
		const nearRight = clientX >= targetWindow.innerWidth - zone;
		const nearTop = clientY >= 0 && clientY <= zone;
		const nearBottom = clientY >= targetWindow.innerHeight - zone && clientY <= targetWindow.innerHeight;

		targetDocument.body.classList.toggle(OMAWRITE_TOP_CORNER_CLASS, nearRight && nearTop);
		targetDocument.body.classList.toggle(OMAWRITE_BOTTOM_CORNER_CLASS, nearRight && nearBottom);
	}

	private updateFullscreenButton(): void {
		if (!this.fullscreenButton) return;

		const fullscreen = Boolean(document.fullscreenElement);
		setIcon(this.fullscreenButton, fullscreen ? "minimize-2" : "maximize-2");
		const label = fullscreen ? this.translations.exitFullscreen : this.translations.enterFullscreen;
		this.fullscreenButton.setAttribute("aria-label", label);
		this.fullscreenButton.setAttribute("title", label);
		this.fullscreenButton.classList.toggle("is-fullscreen", fullscreen);
	}

	private handleFullscreenChange(): void {
		this.updateFullscreenButton();
	}

	private async toggleFullscreen(targetDocument: Document = document): Promise<void> {
		this.managedFullscreenChanges += 1;
		try {
			if (targetDocument.fullscreenElement) {
				await targetDocument.exitFullscreen();
			} else if (targetDocument.documentElement.requestFullscreen) {
				await targetDocument.documentElement.requestFullscreen();
			} else {
				this.notify(this.translations.fullscreenUnavailable);
			}
		} catch {
			this.notify(this.translations.fullscreenFailed);
		} finally {
			this.managedFullscreenChanges = Math.max(0, this.managedFullscreenChanges - 1);
		}

		this.updateFullscreenButton();
	}

	private async toggleCurrentNote(): Promise<void> {
		const view = this.getActiveMarkdownView();
		if (!view?.file) {
			this.notify(this.translations.openNoteFirst);
			return;
		}

		await this.setCurrentNoteEnabled(!this.isEnabled(view.file.path));
	}

	async setCurrentNoteEnabled(enabled: boolean): Promise<void> {
		const view = this.getActiveMarkdownView();
		if (!view?.file) {
			this.notify(this.translations.openNoteFirst);
			return;
		}

		const path = view.file.path;
		if (enabled) {
			this.activeNotePaths.add(path);
		} else {
			this.activeNotePaths.delete(path);
		}

		this.refreshViews();
		this.notify(enabled ? this.translations.modeEnabled : this.translations.modeDisabled);
	}

	async activateFromSettings(): Promise<void> {
		const view = this.getActiveMarkdownView();
		if (!view?.file) {
			this.notify(this.translations.openNoteFirst);
			return;
		}

		const targetDocument = this.getViewDocument(view);
		const wasFullscreen = Boolean(targetDocument.fullscreenElement);
		this.closeSettingsWindow();
		targetDocument.defaultView?.focus();
		await this.setCurrentNoteEnabled(true);

		if (wasFullscreen && !targetDocument.fullscreenElement) {
			await this.toggleFullscreen(targetDocument);
		}
	}

	private closeSettingsWindow(): void {
		const appWithSettings = this.app as AppWithInternalSettings;
		if (typeof appWithSettings.setting?.close === "function") {
			appWithSettings.setting.close();
			return;
		}

		const settingsWindow = typeof window !== "undefined" ? window : null;
		if (settingsWindow && settingsWindow !== this.getViewDocument(this.getActiveMarkdownView()).defaultView) {
			settingsWindow.close();
		}
	}

	async updateSettings(changes: Partial<OmawriteSettings>): Promise<void> {
		if (
			changes.backgroundImagePath !== undefined &&
			changes.backgroundImagePath !== this.settings.backgroundImagePath
		) {
			this.clearBackgroundImageCache();
		}
		this.settings = { ...this.settings, ...changes };
		await this.saveSettings();
		this.refreshViews();
	}

	private refreshViews(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (!(leaf.view instanceof MarkdownView)) return;

			const file = leaf.view.file;
			this.setViewMode(leaf.view, Boolean(file && this.isEnabled(file.path)));
		});

		const activeView = this.getActiveMarkdownView();
		const activeFile = activeView?.file;
		this.setDistractionFree(
			Boolean(activeFile && this.isEnabled(activeFile.path)),
			this.getViewDocument(activeView),
		);
		this.updateWordCount();
	}

	private setDistractionFree(enabled: boolean, targetDocument: Document = document): void {
		targetDocument.body.classList.toggle(OMAWRITE_DISTRACTION_FREE_CLASS, enabled);
		this.exitButton?.classList.toggle("is-visible", enabled);
		this.fullscreenButton?.classList.toggle("is-visible", enabled);
		this.wordCountElement?.classList.toggle("is-visible", enabled);
		if (enabled) {
			this.updateCornerVisibility(this.pointerX, this.pointerY, targetDocument);
		} else {
			this.updateCornerVisibility(-1, -1, targetDocument);
			if (targetDocument.fullscreenElement) {
				void targetDocument.exitFullscreen().catch(() => undefined);
			}
		}
	}

	private setViewMode(view: MarkdownView, enabled: boolean): void {
		const elements = [view.containerEl, view.contentEl];
		const seen = new Set<HTMLElement>();
		const backgroundImage = enabled ? this.getBackgroundImageCss() : null;
		this.setBackgroundLayer(view, enabled, backgroundImage);

		for (const element of elements) {
			if (seen.has(element)) continue;
			seen.add(element);
			element.classList.toggle(OMAWRITE_CLASS, enabled);

			if (enabled) {
				element.style.setProperty("--omawrite-font-size", `${this.settings.fontSize}px`);
				element.style.setProperty("--omawrite-line-width", `${this.settings.lineWidth}ch`);
				element.style.setProperty("--omawrite-top-spacing", `${this.settings.topSpacing}vh`);
				element.style.setProperty("--omawrite-text-align", this.settings.textAlignment);
				element.style.setProperty("--omawrite-background-image", backgroundImage ?? "none");
				element.style.setProperty(
					"--omawrite-background-opacity",
					backgroundImage ? `${this.settings.backgroundOpacity / 100}` : "0",
				);
			} else {
				element.style.removeProperty("--omawrite-font-size");
				element.style.removeProperty("--omawrite-line-width");
				element.style.removeProperty("--omawrite-top-spacing");
				element.style.removeProperty("--omawrite-text-align");
				element.style.removeProperty("--omawrite-background-image");
				element.style.removeProperty("--omawrite-background-opacity");
			}
		}
	}

	private setBackgroundLayer(
		view: MarkdownView,
		enabled: boolean,
		backgroundImage: string | null,
	): void {
		const contentEl = view.contentEl;
		let layer = contentEl.querySelector<HTMLDivElement>(`.${OMAWRITE_BACKGROUND_CLASS}`);

		if (!enabled || !backgroundImage) {
			layer?.remove();
			return;
		}

		if (!layer) {
			layer = document.createElement("div");
			layer.className = OMAWRITE_BACKGROUND_CLASS;
			layer.setAttribute("aria-hidden", "true");
			contentEl.prepend(layer);
		}

		layer.style.backgroundImage = backgroundImage;
		layer.style.opacity = `${this.settings.backgroundOpacity / 100}`;
	}

	private getBackgroundImageCss(): string | null {
		const path = this.settings.backgroundImagePath.trim();
		if (!path) return null;

		if (this.backgroundImageCachePath !== path || !this.backgroundImageCache) {
			if (this.backgroundImageLoadingPath !== path) {
				void this.loadBackgroundImage(path);
			}
			return null;
		}

		return `url(${JSON.stringify(this.backgroundImageCache)})`;
	}

	private async loadBackgroundImage(filePath: string): Promise<void> {
		this.backgroundImageLoadingPath = filePath;

		try {
			const mimeType = getImageMimeType(filePath);
			const fileSystem = loadNodeModule("fs") as NodeFileSystem | null;
			if (!mimeType || !fileSystem) return;

			const bytes = await readExternalFile(fileSystem, filePath);
			if (!bytes || this.settings.backgroundImagePath.trim() !== filePath) return;

			const copy = new Uint8Array(bytes.byteLength);
			copy.set(bytes);
			const blob = new Blob([copy.buffer], { type: mimeType });
			const objectUrl = URL.createObjectURL(blob);
			this.replaceBackgroundImageCache(filePath, objectUrl);
			this.refreshViews();
		} catch {
			// Keep the editor responsive if the external file is unavailable.
		} finally {
			if (this.backgroundImageLoadingPath === filePath) {
				this.backgroundImageLoadingPath = "";
			}
		}
	}

	/**
	 * Loads a temporary object URL for the Settings preview. It deliberately
	 * uses a separate URL from the note background cache so opening Settings
	 * cannot invalidate an image that is already being displayed in a note.
	 */
	async loadBackgroundImagePreview(): Promise<string | null> {
		const filePath = this.settings.backgroundImagePath.trim();
		if (!filePath) return null;

		try {
			const mimeType = getImageMimeType(filePath);
			const fileSystem = loadNodeModule("fs") as NodeFileSystem | null;
			if (!mimeType || !fileSystem) return null;

			const bytes = await readExternalFile(fileSystem, filePath);
			if (!bytes) return null;

			const copy = new Uint8Array(bytes.byteLength);
			copy.set(bytes);
			const blob = new Blob([copy.buffer], { type: mimeType });
			return URL.createObjectURL(blob);
		} catch {
			return null;
		}
	}

	async openBackgroundImagePicker(): Promise<void> {
		const dialog = getElectronDialog();
		if (!dialog) {
			this.notify(this.translations.nativePickerUnavailable);
			return;
		}

		const result = await dialog.showOpenDialog({
			title: this.translations.backgroundPickerTitle,
			properties: ["openFile"],
			filters: [
				{
					name: this.translations.imageFilter,
					extensions: [
						"png",
						"jpg",
						"jpeg",
						"gif",
						"webp",
						"bmp",
						"svg",
						"avif",
						"heic",
						"heif",
						"tif",
						"tiff",
						"ico",
					],
				},
			],
		});

		if (result.canceled || result.filePaths.length === 0) return;

		// The dialog returns the absolute Windows path without touching a renderer
		// <input type="file"> change event. This keeps Settings interactive while
		// the existing asynchronous fs -> Blob loader prepares the background.
		this.setBackgroundImagePath(result.filePaths[0]);
	}

	private setBackgroundImagePath(filePath: string, imageDataUrl: string | null = null): void {
		this.replaceBackgroundImageCache(filePath, imageDataUrl);
		this.settings.backgroundImagePath = filePath;
		// Return control to the native file picker immediately. Rendering and
		// image decoding happen on the next task, outside its change event.
		window.setTimeout(() => {
			try {
				this.refreshViews();
			} catch {
				// A transient view should never make Settings unusable.
			}
		}, 0);
		// Do not keep the native file-input change event waiting on Obsidian's
		// vault-data write. The path is persisted independently while Settings
		// remains immediately interactive.
		window.setTimeout(() => {
			void this.saveSettings().catch(() => {
				this.notify(this.translations.backgroundSaveFailed);
			});
		}, 0);
		this.notify(this.translations.backgroundSelected);
	}

	private replaceBackgroundImageCache(filePath: string, imageUrl: string | null): void {
		this.clearBackgroundImageCache();
		this.backgroundImageCachePath = imageUrl ? filePath : "";
		this.backgroundImageCache = imageUrl;
	}

	private clearBackgroundImageCache(): void {
		if (this.backgroundImageCache?.startsWith("blob:")) {
			URL.revokeObjectURL(this.backgroundImageCache);
		}
		this.backgroundImageCachePath = "";
		this.backgroundImageCache = null;
		this.backgroundImageLoadingPath = "";
	}
}

interface NodeFileSystem {
	promises?: {
		readFile?: (path: string) => Promise<Uint8Array>;
		writeFile?: (path: string, data: string, encoding?: string) => Promise<void>;
	};
	readFile?: (path: string, callback: (error: unknown, data?: Uint8Array) => void) => void;
}

interface VaultAdapterWithFullPath {
	write?: (path: string, data: string) => Promise<void>;
	getFullPath?: (path: string) => string;
	getBasePath?: () => string;
}

interface OmawriteHotkey {
	modifiers?: string[];
	key: string;
}

interface AppWithInternalCommands {
	commands?: {
		commands?: Record<string, { hotkeys?: OmawriteHotkey[] }>;
	};
}

interface AppWithInternalSettings {
	setting?: {
		close?: () => void;
	};
}

interface ElectronDialogResult {
	canceled: boolean;
	filePaths: string[];
}

interface ElectronDialogApi {
	showOpenDialog: (options: {
		properties: string[];
		filters?: Array<{ name: string; extensions: string[] }>;
		title?: string;
	}) => Promise<ElectronDialogResult>;
}

interface ElectronRemoteApi {
	dialog?: ElectronDialogApi;
}

async function readExternalFile(fileSystem: NodeFileSystem, filePath: string): Promise<Uint8Array | null> {
	if (fileSystem.promises?.readFile) {
		return await fileSystem.promises.readFile(filePath);
	}

	if (!fileSystem.readFile) return null;

	return await new Promise<Uint8Array | null>((resolve, reject) => {
		fileSystem.readFile?.(filePath, (error, data) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(data ?? null);
		});
	});
}

function loadNodeModule(moduleName: string): unknown {
	try {
		if (typeof require === "function") return require(moduleName);
	} catch {
		// Try the renderer's exposed require below.
	}

	try {
		const exposedRequire = (window as Window & { require?: (name: string) => unknown }).require;
		return typeof exposedRequire === "function" ? exposedRequire(moduleName) : null;
	} catch {
		return null;
	}
}

function formatHotkeys(
	hotkeys: OmawriteHotkey[],
	isMacOS: boolean,
	translations: OmawriteTranslations,
): string {
	if (hotkeys.length === 0) return translations.noShortcut;

	return hotkeys
		.map((hotkey) => {
			const modifiers = (hotkey.modifiers ?? []).map((modifier) =>
				formatHotkeyModifier(modifier, isMacOS),
			);
			const key = formatHotkeyKey(hotkey.key, translations);
			return [...modifiers, key].filter(Boolean).join(" + ");
		})
		.join(" / ");
}

function formatHotkeyModifier(modifier: string, isMacOS: boolean): string {
	if (modifier === "Mod") return isMacOS ? "⌘" : "Ctrl";
	if (modifier === "Meta") return "⌘";
	if (modifier === "Control") return "Ctrl";
	return modifier;
}

function formatHotkeyKey(key: string, translations: OmawriteTranslations): string {
	return translations.keyNames[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

interface WordSegment {
	isWordLike?: boolean;
}

interface WordSegmenter {
	segment(text: string): Iterable<WordSegment>;
}

interface WordSegmenterConstructor {
	new (locales: string | string[], options: { granularity: "word" }): WordSegmenter;
}

function getTextStatistics(text: string, locale: PluginLocale): { words: number; characters: number } {
	const characters = Array.from(text).length;
	if (!text.trim()) return { words: 0, characters };

	const segmenterConstructor = (Intl as unknown as { Segmenter?: WordSegmenterConstructor })
		.Segmenter;
	if (segmenterConstructor) {
		const segmenter = new segmenterConstructor(locale, { granularity: "word" });
		let words = 0;
		for (const segment of segmenter.segment(text)) {
			if (segment.isWordLike) words += 1;
		}
		return { words, characters };
	}

	const cjkCharacters = text.match(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/gu) ?? [];
	const nonCjkWords = text
		.replace(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/gu, " ")
		.trim()
		.split(/\s+/u)
		.filter(Boolean);
	return { words: cjkCharacters.length + nonCjkWords.length, characters };
}

function getElectronDialog(): ElectronDialogApi | null {
	try {
		const electron = loadNodeModule("electron") as
			| (ElectronRemoteApi & { remote?: ElectronRemoteApi })
			| null;
		if (electron?.dialog?.showOpenDialog) return electron.dialog;
		const remoteDialog = electron?.remote?.dialog;
		if (remoteDialog?.showOpenDialog) return remoteDialog;
	} catch {
		// Continue with @electron/remote below.
	}

	try {
		const remoteModule = loadNodeModule("@electron/remote") as
			| (ElectronRemoteApi & { remote?: ElectronRemoteApi })
			| null;
		if (remoteModule?.dialog?.showOpenDialog) return remoteModule.dialog;
		const remoteDialog = remoteModule?.remote?.dialog;
		if (remoteDialog?.showOpenDialog) return remoteDialog;
	} catch {
		// The package is not present in every Obsidian/Electron build.
	}

	return null;
}

class OmawriteSettingTab extends PluginSettingTab {
	plugin: OmawritePlugin;
	private previewContainerEl: HTMLDivElement | null = null;
	private previewBackgroundEl: HTMLDivElement | null = null;
	private previewEmptyEl: HTMLDivElement | null = null;
	private previewImageUrl: string | null = null;
	private previewRequest = 0;

	constructor(app: App, plugin: OmawritePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	hide(): void {
		this.resetPreviewImage();
		super.hide();
	}

	display(): void {
		const { containerEl } = this;
		this.resetPreviewImage();
		this.previewContainerEl = null;
		this.previewBackgroundEl = null;
		this.previewEmptyEl = null;
		containerEl.empty();

		containerEl.createEl("h2", { text: this.plugin.translations.settingsHeading });
		containerEl.createEl("p", {
			text: this.plugin.translations.settingsIntro,
			cls: "setting-item-description",
		});

		const activateSetting = new Setting(containerEl)
			.setName(this.plugin.translations.activateName)
			.setDesc(this.plugin.getActivationHotkeyDescription());
		activateSetting.addButton((button) => {
			button.setButtonText(this.plugin.translations.activateButton).onClick(() => {
				button.setDisabled(true);
				void this.plugin.activateFromSettings().finally(() => {
					button.setDisabled(false);
				});
			});
		});

		new Setting(containerEl)
			.setName(this.plugin.translations.notificationsName)
			.setDesc(this.plugin.translations.notificationsDescription)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.notificationsEnabled)
					.onChange((value) => {
						void this.plugin.updateSettings({ notificationsEnabled: value });
					});
			});

		new Setting(containerEl)
			.setName(this.plugin.translations.fontSizeName)
			.setDesc(this.plugin.translations.fontSizeDescription)
			.addSlider((slider) => {
				slider
					.setLimits(14, 32, 1)
					.setValue(this.plugin.settings.fontSize)
					.setDynamicTooltip()
					.onChange((value) => {
						this.applyPreviewSettings({ fontSize: value });
						void this.plugin.updateSettings({ fontSize: value });
					});
			});

		new Setting(containerEl)
			.setName(this.plugin.translations.lineWidthName)
			.setDesc(this.plugin.translations.lineWidthDescription)
			.addSlider((slider) => {
				slider
					.setLimits(45, 150, 1)
					.setValue(this.plugin.settings.lineWidth)
					.setDynamicTooltip()
					.onChange((value) => {
						this.applyPreviewSettings({ lineWidth: value });
						void this.plugin.updateSettings({ lineWidth: value });
					});
			});

		new Setting(containerEl)
			.setName(this.plugin.translations.topSpacingName)
			.setDesc(this.plugin.translations.topSpacingDescription)
			.addSlider((slider) => {
				slider
					.setLimits(0, 15, 1)
					.setValue(this.plugin.settings.topSpacing)
					.setDynamicTooltip()
					.onChange((value) => {
						this.applyPreviewSettings({ topSpacing: value });
						void this.plugin.updateSettings({ topSpacing: value });
					});
			});

		const backgroundSetting = new Setting(containerEl)
			.setName(this.plugin.translations.backgroundName)
			.setDesc(this.getBackgroundImageDescription());
		backgroundSetting.addButton((button) => {
			button.setButtonText(this.plugin.translations.chooseImageButton).onClick(() => {
				void (async () => {
					button.setDisabled(true);
					try {
						await this.plugin.openBackgroundImagePicker();
						backgroundSetting.setDesc(this.getBackgroundImageDescription());
						void this.updatePreview();
					} catch {
						this.plugin.notify(this.plugin.translations.backgroundSelectFailed);
					} finally {
						button.setDisabled(false);
					}
				})();
			});
		});
		backgroundSetting.addButton((button) => {
			button.setButtonText(this.plugin.translations.clearButton).onClick(() => {
				void (async () => {
					button.setDisabled(true);
					try {
						await this.plugin.updateSettings({ backgroundImagePath: "" });
						backgroundSetting.setDesc(this.getBackgroundImageDescription());
						void this.updatePreview();
					} catch {
						this.plugin.notify(this.plugin.translations.backgroundClearFailed);
					} finally {
						button.setDisabled(false);
					}
				})();
			});
		});

		new Setting(containerEl)
			.setName(this.plugin.translations.opacityName)
			.setDesc(this.plugin.translations.opacityDescription)
			.addSlider((slider) => {
				slider
					.setLimits(0, 100, 1)
					.setValue(this.plugin.settings.backgroundOpacity)
					.setDynamicTooltip()
					.onChange((value) => {
						this.applyPreviewSettings({ backgroundOpacity: value });
						void this.plugin.updateSettings({ backgroundOpacity: value });
					});
			});

		new Setting(containerEl)
			.setName(this.plugin.translations.alignmentName)
			.setDesc(this.plugin.translations.alignmentDescription)
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(this.plugin.translations.alignmentOptions)
					.setValue(this.plugin.settings.textAlignment)
					.onChange((value) => {
						const textAlignment = this.plugin.normalizeTextAlignment(value);
						this.applyPreviewSettings({ textAlignment });
						void this.plugin.updateSettings({ textAlignment });
					});
			});

		const previewSetting = new Setting(containerEl)
			.setClass("omawrite-preview-setting")
			.setName(this.plugin.translations.previewName)
			.setDesc(this.plugin.translations.previewDescription);
		this.previewContainerEl = previewSetting.controlEl.createDiv({
			cls: "omawrite-background-preview",
		});
		this.previewBackgroundEl = this.previewContainerEl.createDiv({
			cls: "omawrite-background-preview-image",
			attr: { "aria-hidden": "true" },
		});
		const previewContent = this.previewContainerEl.createDiv({
			cls: "omawrite-background-preview-content",
		});
		previewContent.createEl("div", {
			text: this.plugin.translations.previewSampleTitle,
			cls: "omawrite-background-preview-heading",
		});
		previewContent.createEl("p", {
			text: this.plugin.translations.previewSampleText,
			cls: "omawrite-background-preview-text",
		});
		this.previewEmptyEl = previewContent.createDiv({
			cls: "omawrite-background-preview-empty",
		});
		this.applyPreviewSettings();
		void this.updatePreview();

		containerEl.createEl("p", {
			text: this.plugin.translations.markdownUnchanged,
			cls: "setting-item-description",
		});
	}

	private getBackgroundImageDescription(): string {
		return this.plugin.settings.backgroundImagePath
			? this.plugin.translations.backgroundSelectedDescription(this.plugin.settings.backgroundImagePath)
			: this.plugin.translations.backgroundEmptyDescription;
	}

	private async updatePreview(): Promise<void> {
		const request = this.previewRequest;
		const previewContainer = this.previewContainerEl;
		const previewBackground = this.previewBackgroundEl;
		const previewEmpty = this.previewEmptyEl;
		if (!previewContainer || !previewBackground || !previewEmpty) return;

		const filePath = this.plugin.settings.backgroundImagePath.trim();
		previewBackground.style.backgroundImage = "none";
		this.applyPreviewSettings();
		previewContainer.classList.toggle("is-loading", Boolean(filePath));
		previewContainer.classList.add("is-empty");
		previewEmpty.textContent = filePath
			? this.plugin.translations.previewLoading
			: "";

		if (!filePath) return;

		const imageUrl = await this.plugin.loadBackgroundImagePreview();
		if (request !== this.previewRequest || !this.previewBackgroundEl) {
			if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
			return;
		}

		this.previewImageUrl = imageUrl;
		this.previewContainerEl?.classList.remove("is-loading");
		this.previewContainerEl?.classList.toggle("is-empty", !imageUrl);
		this.previewEmptyEl!.textContent = imageUrl
			? ""
			: this.plugin.translations.previewLoadFailed;
		if (imageUrl) {
			this.previewBackgroundEl.style.backgroundImage = `url(${JSON.stringify(imageUrl)})`;
		}
	}

	private applyPreviewSettings(
		overrides: Partial<
			Pick<
				OmawriteSettings,
				"fontSize" | "lineWidth" | "topSpacing" | "textAlignment" | "backgroundOpacity"
			>
		> = {},
	): void {
		if (!this.previewContainerEl) return;

		const fontSize = overrides.fontSize ?? this.plugin.settings.fontSize;
		const lineWidth = overrides.lineWidth ?? this.plugin.settings.lineWidth;
		const topSpacing = overrides.topSpacing ?? this.plugin.settings.topSpacing;
		const textAlignment = overrides.textAlignment ?? this.plugin.settings.textAlignment;
		const backgroundOpacity =
			overrides.backgroundOpacity ?? this.plugin.settings.backgroundOpacity;

		this.previewContainerEl.style.setProperty(
			"--omawrite-preview-font-size",
			`${Math.min(32, Math.max(14, fontSize))}px`,
		);
		this.previewContainerEl.style.setProperty(
			"--omawrite-preview-line-width",
			`${(Math.min(150, Math.max(45, lineWidth)) / 150) * 100}%`,
		);
		this.previewContainerEl.style.setProperty(
			"--omawrite-preview-top-spacing",
			`${Math.min(15, Math.max(0, topSpacing)) * 1.4}px`,
		);
		this.previewContainerEl.style.setProperty(
			"--omawrite-preview-text-align",
			textAlignment,
		);

		if (this.previewBackgroundEl) {
			const opacity = Math.min(100, Math.max(0, backgroundOpacity)) / 100;
			this.previewBackgroundEl.style.opacity = `${opacity}`;
		}
	}

	private resetPreviewImage(): void {
		this.previewRequest += 1;
		if (this.previewImageUrl?.startsWith("blob:")) {
			URL.revokeObjectURL(this.previewImageUrl);
		}
		this.previewImageUrl = null;
	}
}

function getImageMimeType(filePath: string): string | null {
	const extension = filePath.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
	if (!extension) return null;

	const mimeTypes: Record<string, string> = {
		avif: "image/avif",
		bmp: "image/bmp",
		gif: "image/gif",
		heic: "image/heic",
		heif: "image/heif",
		ico: "image/x-icon",
		jpeg: "image/jpeg",
		jfif: "image/jpeg",
		jpg: "image/jpeg",
		jxl: "image/jxl",
		png: "image/png",
		svg: "image/svg+xml",
		tif: "image/tiff",
		tiff: "image/tiff",
		webp: "image/webp",
	};

	return mimeTypes[extension] ?? null;
}
