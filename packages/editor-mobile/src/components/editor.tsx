/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import {
  Editor,
  getFontById,
  PortalProvider,
  Toolbar,
  usePermissionHandler,
  useTiptap
} from "@notesnook/editor";
import { useThemeColors } from "@notesnook/theme";
import {
  forwardRef,
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { useEditorController } from "../hooks/useEditorController";
import { useSettings } from "../hooks/useSettings";
import { EmotionEditorToolbarTheme } from "../theme-factory";
import { EventTypes, Settings } from "../utils";
import Header from "./header";
import StatusBar from "./statusbar";
import Tags from "./tags";
import Title from "./title";
import { toBlobURL } from "@notesnook/editor/dist/utils/downloader";

globalThis.toBlobURL = toBlobURL as typeof globalThis.toBlobURL;

const Tiptap = ({ settings }: { settings: Settings }) => {
  const [tick, setTick] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState(false);
  usePermissionHandler({
    claims: {
      premium: settings.premium
    },
    onPermissionDenied: () => {
      post(EventTypes.pro);
    }
  });
  const _editor = useTiptap(
    {
      onUpdate: ({ editor, transaction }) => {
        global.editorController.contentChange(
          editor as Editor,
          transaction.getMeta("ignoreEdit")
        );
      },
      onOpenAttachmentPicker: (editor, type) => {
        global.editorController.openFilePicker(type);
        return true;
      },
      onDownloadAttachment: (editor, attachment) => {
        global.editorController.downloadAttachment(attachment);
        return true;
      },
      onPreviewAttachment(editor, attachment) {
        global.editorController.previewAttachment(attachment);
        return true;
      },
      getAttachmentData(attachment) {
        return global.editorController.getAttachmentData(attachment);
      },
      element: !layout ? undefined : contentRef.current || undefined,
      editable: !settings.readonly,
      editorProps: {
        editable: () => !settings.readonly
      },
      content: global.editorController?.content?.current,
      isMobile: true,
      doubleSpacedLines: settings.doubleSpacedLines,
      onOpenLink: (url) => {
        return global.editorController.openLink(url);
      },
      copyToClipboard: (text) => {
        globalThis.editorController.copyToClipboard(text);
      },
      downloadOptions: {
        corsHost: settings.corsProxy
      },
      dateFormat: settings.dateFormat,
      timeFormat: settings.timeFormat as "12-hour" | "24-hour" | undefined
    },
    [layout, settings.readonly, tick, settings.doubleSpacedLines]
  );

  const update = useCallback(() => {
    setTick((tick) => tick + 1);
    containerRef.current?.scrollTo?.({
      left: 0,
      top: 0
    });
    globalThis.editorController.setTitlePlaceholder("Note title");
  }, []);

  const controller = useEditorController(update);
  const controllerRef = useRef(controller);
  globalThis.editorController = controller;
  globalThis.editor = _editor;

  useLayoutEffect(() => {
    setLayout(true);
  }, []);

  const onClickEmptyArea: React.MouseEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      const y = event.nativeEvent.pageY;
      const x = event.nativeEvent.pageX;
      const element = document.elementFromPoint(x, y);
      if (!element) return;
      if (element.id === "statusbar" || element.id === "header") {
        if (
          containerRef.current?.scrollTop &&
          containerRef.current?.scrollTop > 0
        ) {
          containerRef.current?.scrollTo({
            left: 0,
            top: 0,
            behavior: "smooth"
          });
          return;
        }

        const firstChild = globalThis.editor?.state.doc.firstChild;
        const isParagraph = firstChild?.type.name === "paragraph";
        const isFirstChildEmpty =
          !firstChild?.textContent || firstChild?.textContent?.length === 0;
        if (isParagraph && isFirstChildEmpty) {
          globalThis.editor?.commands.focus("end");
          return;
        }
        globalThis.editor
          ?.chain()
          .insertContentAt(0, "<p></p>", {
            updateSelection: true
          })
          .focus("end")
          .run();
      }
    },
    []
  );

  const onClickBottomArea = useCallback(() => {
    const docSize = globalThis.editor?.state.doc.content.size;
    if (!docSize) return;
    const lastChild = globalThis.editor?.state.doc.lastChild;
    const isParagraph = lastChild?.type.name === "paragraph";
    const isLastChildEmpty =
      !lastChild?.textContent || lastChild?.textContent?.length === 0;
    if (isParagraph && isLastChildEmpty) {
      globalThis.editor?.commands.focus("end");
      return;
    }
    globalThis.editor
      ?.chain()
      .insertContentAt(docSize - 1, "<p></p>", {
        updateSelection: true
      })
      .focus("end")
      .run();
  }, []);
  return (
    <>
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          maxWidth: "100vw"
        }}
        id="editorroot"
        onDoubleClick={onClickEmptyArea}
      >
        <Header
          hasRedo={_editor?.can().redo() || false}
          hasUndo={_editor?.can().undo() || false}
          settings={settings}
          noHeader={settings.noHeader || false}
        />
        <div
          onScroll={controller.scroll}
          ref={containerRef}
          style={{
            overflowY: "scroll",
            height: "100%",
            display: "block"
          }}
        >
          {settings.noHeader ? null : (
            <>
              <Tags settings={settings} />
              <Title
                titlePlaceholder={controller.titlePlaceholder}
                readonly={settings.readonly}
                controller={controllerRef}
                title={controller.title}
                fontFamily={settings.fontFamily}
                dateFormat={settings.dateFormat}
                timeFormat={settings.timeFormat}
              />
              <StatusBar container={containerRef} />
            </>
          )}

          <ContentDiv
            padding={settings.doubleSpacedLines ? 0 : 6}
            fontSize={settings.fontSize}
            fontFamily={settings.fontFamily}
            ref={contentRef}
          />

          <div
            onTouchEnd={(e) => {
              e.preventDefault();
              onClickBottomArea();
            }}
            style={{
              flexGrow: 1,
              width: "100%",
              minHeight: 250
            }}
          />
        </div>

        {!layout ? null : (
          <EmotionEditorToolbarTheme>
            <Toolbar
              className="theme-scope-editorToolbar"
              sx={{
                display: settings.noToolbar ? "none" : "flex",
                overflowY: "hidden",
                minHeight: "50px"
              }}
              editor={_editor}
              location="bottom"
              tools={[...settings.tools]}
              defaultFontFamily={settings.fontFamily}
              defaultFontSize={settings.fontSize}
            />
          </EmotionEditorToolbarTheme>
        )}
      </div>
    </>
  );
};

const ContentDiv = memo(
  forwardRef<
    HTMLDivElement,
    { padding: number; fontSize: number; fontFamily: string }
  >((props, ref) => {
    const { colors } = useThemeColors("editor");
    return (
      <div
        ref={ref}
        className="theme-scope-editor"
        style={{
          padding: 12,
          paddingTop: props.padding,
          color: colors.primary.paragraph,
          marginTop: -12,
          caretColor: colors.primary.accent,
          fontSize: props.fontSize,
          fontFamily: getFontById(props.fontFamily)?.font
        }}
      />
    );
  }),
  (prev, next) => {
    if (prev.fontSize !== next.fontSize || prev.fontFamily !== next.fontFamily)
      return false;
    return true;
  }
);

const TiptapProvider = (): JSX.Element => {
  const settings = useSettings();

  return (
    <PortalProvider>
      <Tiptap settings={settings} />
    </PortalProvider>
  );
};

export default TiptapProvider;
