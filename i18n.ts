import { getLanguage } from "obsidian";

export type PluginLocale = "en" | "es" | "zh";
export type OmawriteTextAlignment = "left" | "justify" | "center" | "right";

export interface OmawriteTranslations {
	locale: PluginLocale;
	alignmentOptions: Record<OmawriteTextAlignment, string>;
	commandToggle: string;
	commandToggleFullscreen: string;
	commandEnable: string;
	commandDisable: string;
	ribbonToggle: string;
	exitMode: string;
	enterFullscreen: string;
	exitFullscreen: string;
	openNoteFirst: string;
	fullscreenUnavailable: string;
	fullscreenFailed: string;
	modeEnabled: string;
	modeDisabled: string;
	hotkeyDescription: (normal: string, fullscreen: string) => string;
	noShortcut: string;
	keyNames: Record<string, string>;
	nativePickerUnavailable: string;
	backgroundPickerTitle: string;
	imageFilter: string;
	backgroundSelectFailed: string;
	backgroundClearFailed: string;
	backgroundSaveFailed: string;
	backgroundSelected: string;
	settingsHeading: string;
	settingsIntro: string;
	activateName: string;
	activateButton: string;
	notificationsName: string;
	notificationsDescription: string;
	fontSizeName: string;
	fontSizeDescription: string;
	lineWidthName: string;
	lineWidthDescription: string;
	topSpacingName: string;
	topSpacingDescription: string;
	backgroundName: string;
	backgroundEmptyDescription: string;
	backgroundSelectedDescription: (path: string) => string;
	chooseImageButton: string;
	clearButton: string;
	opacityName: string;
	opacityDescription: string;
	alignmentName: string;
	alignmentDescription: string;
	previewName: string;
	previewDescription: string;
	previewSampleTitle: string;
	previewSampleText: string;
	markdownUnchanged: string;
	previewLoading: string;
	previewLoadFailed: string;
	wordCount: (words: string, characters: string) => string;
}

const ENGLISH_KEY_NAMES: Record<string, string> = {
	" ": "Space",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
	ArrowUp: "↑",
	Backspace: "Backspace",
	Delete: "Delete",
	Enter: "Enter",
	Escape: "Esc",
	Tab: "Tab",
};

const SPANISH_KEY_NAMES: Record<string, string> = {
	" ": "Espacio",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
	ArrowUp: "↑",
	Backspace: "Retroceso",
	Delete: "Suprimir",
	Enter: "Intro",
	Escape: "Esc",
	Tab: "Tab",
};

const CHINESE_KEY_NAMES: Record<string, string> = {
	" ": "空格",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
	ArrowUp: "↑",
	Backspace: "退格",
	Delete: "删除",
	Enter: "回车",
	Escape: "Esc",
	Tab: "Tab",
};

const TRANSLATIONS: Record<PluginLocale, OmawriteTranslations> = {
	en: {
		locale: "en",
		alignmentOptions: {
			left: "Left",
			justify: "Justified",
			center: "Centered",
			right: "Right",
		},
		commandToggle: "Toggle Omawrite mode for current note",
		commandToggleFullscreen: "Toggle Omawrite mode and fullscreen for current note",
		commandEnable: "Enable Omawrite mode for current note",
		commandDisable: "Disable Omawrite mode for current note",
		ribbonToggle: "Toggle Omawrite mode for current note",
		exitMode: "Exit Omawrite writing mode",
		enterFullscreen: "Enter fullscreen",
		exitFullscreen: "Exit fullscreen",
		openNoteFirst: "Open a Markdown note to activate Omawrite.",
		fullscreenUnavailable: "This environment does not allow fullscreen from Obsidian.",
		fullscreenFailed: "Obsidian could not enter fullscreen.",
		modeEnabled: "Omawrite enabled for this note.",
		modeDisabled: "Omawrite disabled for this note.",
		hotkeyDescription: (normal, fullscreen) =>
			`Normal shortcut: ${normal} · Fullscreen shortcut: ${fullscreen}`,
		noShortcut: "no shortcut configured",
		keyNames: ENGLISH_KEY_NAMES,
		nativePickerUnavailable: "The native file picker is not available in this Obsidian version.",
		backgroundPickerTitle: "Choose background image",
		imageFilter: "Images",
		backgroundSelectFailed: "Could not select the background image.",
		backgroundClearFailed: "Could not clear the background image.",
		backgroundSaveFailed: "Could not save the background image path.",
		backgroundSelected: "Background image selected.",
		settingsHeading: "Modo Omawrite",
		settingsIntro:
			"Applies a centered writing surface, monospaced typography, and restrained colors to active notes.",
		activateName: "Activate Omawrite Mode",
		activateButton: "Activate",
		notificationsName: "Notifications",
		notificationsDescription: "Show confirmation and error notifications from Omawrite.",
		fontSizeName: "Text size",
		fontSizeDescription: "Base size of the editor and preview.",
		lineWidthName: "Writing width",
		lineWidthDescription: "Approximate number of characters per line.",
		topSpacingName: "Top spacing",
		topSpacingDescription: "Space between the preview heading and the text.",
		backgroundName: "Background image",
		backgroundEmptyDescription: "Choose an image from any Windows folder.",
		backgroundSelectedDescription: (path) => `Selected file: ${path}`,
		chooseImageButton: "Choose image",
		clearButton: "Clear",
		opacityName: "Image opacity",
		opacityDescription:
			"0% hides it; 100% shows it fully. The initial value is subtle to preserve readability.",
		alignmentName: "Text alignment",
		alignmentDescription: "Applies to the note content and preview.",
		previewName: "Contrast preview",
		previewDescription:
			"Shows the current size, width, top spacing, alignment, font, background, and opacity in real time.",
		previewSampleTitle: "Example title",
		previewSampleText: "Example text to check contrast.",
		markdownUnchanged: "Markdown content is not modified. The style only applies to the note interface.",
		previewLoading: "Loading the selected image…",
		previewLoadFailed: "Could not load the selected image.",
		wordCount: (words, characters) => `${words} words · ${characters} characters`,
	},
	es: {
		locale: "es",
		alignmentOptions: {
			left: "Izquierda",
			justify: "Justificada",
			center: "Centrada",
			right: "Derecha",
		},
		commandToggle: "Alternar modo Omawrite para la nota actual",
		commandToggleFullscreen: "Alternar modo Omawrite y pantalla completa para la nota actual",
		commandEnable: "Activar modo Omawrite para la nota actual",
		commandDisable: "Desactivar modo Omawrite para la nota actual",
		ribbonToggle: "Alternar modo Omawrite para la nota actual",
		exitMode: "Salir del modo de escritura Omawrite",
		enterFullscreen: "Entrar en pantalla completa",
		exitFullscreen: "Salir de pantalla completa",
		openNoteFirst: "Abre una nota Markdown para activar Omawrite.",
		fullscreenUnavailable: "Este entorno no permite pantalla completa desde Obsidian.",
		fullscreenFailed: "Obsidian no pudo cambiar a pantalla completa.",
		modeEnabled: "Omawrite activado para esta nota.",
		modeDisabled: "Omawrite desactivado para esta nota.",
		hotkeyDescription: (normal, fullscreen) =>
			`Atajo normal: ${normal} · Atajo pantalla completa: ${fullscreen}`,
		noShortcut: "sin atajo configurado",
		keyNames: SPANISH_KEY_NAMES,
		nativePickerUnavailable: "El selector nativo no está disponible en esta versión de Obsidian.",
		backgroundPickerTitle: "Elegir imagen de fondo",
		imageFilter: "Imágenes",
		backgroundSelectFailed: "No se pudo seleccionar la imagen de fondo.",
		backgroundClearFailed: "No se pudo limpiar la imagen de fondo.",
		backgroundSaveFailed: "No se pudo guardar la ruta de la imagen de fondo.",
		backgroundSelected: "Imagen de fondo seleccionada.",
		settingsHeading: "Omawrite mode",
		settingsIntro:
			"Aplica una superficie de escritura centrada, tipografía monoespaciada y colores sobrios a las notas que actives.",
		activateName: "Activar Omawrite Mode",
		activateButton: "Activar",
		notificationsName: "Notificaciones",
		notificationsDescription: "Muestra u oculta las confirmaciones y errores de Omawrite.",
		fontSizeName: "Tamaño del texto",
		fontSizeDescription: "El tamaño base del editor y de la vista previa.",
		lineWidthName: "Ancho de escritura",
		lineWidthDescription: "Número aproximado de caracteres por línea.",
		topSpacingName: "Espacio superior",
		topSpacingDescription: "Separación entre el encabezado de la vista y el texto.",
		backgroundName: "Imagen de fondo",
		backgroundEmptyDescription: "Selecciona una imagen desde cualquier carpeta de Windows.",
		backgroundSelectedDescription: (path) => `Archivo seleccionado: ${path}`,
		chooseImageButton: "Elegir imagen",
		clearButton: "Limpiar",
		opacityName: "Opacidad de la imagen",
		opacityDescription:
			"0% la oculta; 100% la muestra completamente. El valor inicial es sutil para conservar la legibilidad.",
		alignmentName: "Alineación del texto",
		alignmentDescription: "Se aplica al contenido de la nota y a la vista previa.",
		previewName: "Vista previa de contraste",
		previewDescription:
			"Muestra en tiempo real el tamaño, ancho, espacio superior, alineación, fuente, fondo y opacidad actuales.",
		previewSampleTitle: "Título de ejemplo",
		previewSampleText: "Texto de ejemplo para comprobar el contraste.",
		markdownUnchanged: "El contenido Markdown no se modifica. El estilo se aplica únicamente a la interfaz de la nota.",
		previewLoading: "Cargando la imagen seleccionada…",
		previewLoadFailed: "No se pudo cargar la imagen seleccionada.",
		wordCount: (words, characters) => `${words} palabras · ${characters} caracteres`,
	},
	zh: {
		locale: "zh",
		alignmentOptions: {
			left: "左对齐",
			justify: "两端对齐",
			center: "居中",
			right: "右对齐",
		},
		commandToggle: "切换当前笔记的 Omawrite 模式",
		commandToggleFullscreen: "切换当前笔记的 Omawrite 模式和全屏",
		commandEnable: "为当前笔记启用 Omawrite 模式",
		commandDisable: "为当前笔记停用 Omawrite 模式",
		ribbonToggle: "切换当前笔记的 Omawrite 模式",
		exitMode: "退出 Omawrite 写作模式",
		enterFullscreen: "进入全屏",
		exitFullscreen: "退出全屏",
		openNoteFirst: "请先打开一篇 Markdown 笔记以启用 Omawrite。",
		fullscreenUnavailable: "此环境不允许在 Obsidian 中进入全屏。",
		fullscreenFailed: "Obsidian 无法切换到全屏。",
		modeEnabled: "已为此笔记启用 Omawrite。",
		modeDisabled: "已为此笔记停用 Omawrite。",
		hotkeyDescription: (normal, fullscreen) =>
			`普通快捷键：${normal} · 全屏快捷键：${fullscreen}`,
		noShortcut: "未设置快捷键",
		keyNames: CHINESE_KEY_NAMES,
		nativePickerUnavailable: "此版本的 Obsidian 不提供原生文件选择器。",
		backgroundPickerTitle: "选择背景图片",
		imageFilter: "图片",
		backgroundSelectFailed: "无法选择背景图片。",
		backgroundClearFailed: "无法清除背景图片。",
		backgroundSaveFailed: "无法保存背景图片路径。",
		backgroundSelected: "已选择背景图片。",
		settingsHeading: "Omawrite 模式",
		settingsIntro: "为启用的笔记应用居中的写作界面、等宽字体和简洁配色。",
		activateName: "启用 Omawrite 模式",
		activateButton: "启用",
		notificationsName: "通知",
		notificationsDescription: "显示或隐藏 Omawrite 的确认和错误通知。",
		fontSizeName: "文字大小",
		fontSizeDescription: "编辑器和预览的基础文字大小。",
		lineWidthName: "写作宽度",
		lineWidthDescription: "每行的大致字符数。",
		topSpacingName: "顶部间距",
		topSpacingDescription: "预览标题与正文之间的间距。",
		backgroundName: "背景图片",
		backgroundEmptyDescription: "从 Windows 的任意文件夹选择图片。",
		backgroundSelectedDescription: (path) => `已选择文件：${path}`,
		chooseImageButton: "选择图片",
		clearButton: "清除",
		opacityName: "图片不透明度",
		opacityDescription: "0% 表示隐藏；100% 表示完全显示。较低的初始值有助于保持可读性。",
		alignmentName: "文字对齐方式",
		alignmentDescription: "应用于笔记内容和预览。",
		previewName: "对比度预览",
		previewDescription: "实时显示当前文字大小、宽度、顶部间距、对齐方式、字体、背景和不透明度。",
		previewSampleTitle: "示例标题",
		previewSampleText: "用于检查对比度的示例文字。",
		markdownUnchanged: "不会修改 Markdown 内容。样式仅应用于笔记界面。",
		previewLoading: "正在加载所选图片…",
		previewLoadFailed: "无法加载所选图片。",
		wordCount: (words, characters) => `${words} 个词 · ${characters} 个字符`,
	},
};

export function getPluginLocale(): PluginLocale {
	let language = "en";
	try {
		language = getLanguage();
	} catch {
		// Keep English as a safe fallback if the host API is unavailable.
	}

	const normalized = language.trim().toLowerCase().replace(/_/g, "-");
	if (normalized.startsWith("es")) return "es";
	if (normalized === "zh" || normalized.startsWith("zh-")) return "zh";
	return "en";
}

export function getTranslations(locale: PluginLocale = getPluginLocale()): OmawriteTranslations {
	return TRANSLATIONS[locale];
}

export function isOmawriteTextAlignment(value: unknown): value is OmawriteTextAlignment {
	return value === "left" || value === "justify" || value === "center" || value === "right";
}
