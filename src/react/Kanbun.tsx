'use client';

import { useEffect, useRef, type HTMLAttributes } from 'react';
import { defaultOptions, type LayoutOptions } from '../layout/options.js';
import type { KanbunLayout } from '../layout/engine.js';
import type { RenderOptions } from '../html/renderer.js';
import { KanbunViewer, type ViewerOptions } from '../html/viewer.js';

export interface KanbunProps extends Partial<LayoutOptions>, Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'dangerouslySetInnerHTML' | 'onError'> {
  source: string;
  debug?: RenderOptions;
  autoColumnHeight?: boolean;
  onLayout?: (layout: KanbunLayout) => void;
  onError?: (error: unknown) => void;
  children?: never;
  dangerouslySetInnerHTML?: never;
}

/** Optional React adapter. The host is React-owned; its contents are viewer-owned. */
export function Kanbun({ source, debug, autoColumnHeight, onLayout, onError, ...props }: KanbunProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<KanbunViewer | null>(null);
  const callbacks = useRef({ onLayout, onError });
  useEffect(() => { callbacks.current = { onLayout, onError }; }, [onLayout, onError]);

  const attributes = { ...props };
  const layout: Partial<LayoutOptions> = {};
  for (const key of Object.keys(defaultOptions) as (keyof LayoutOptions)[]) {
    if (props[key] !== undefined) Object.assign(layout, { [key]: props[key] });
    delete attributes[key];
  }
  // Compare option values: fresh JSX objects and callbacks should not cause
  // another layout, including when onLayout updates the parent's state.
  const layoutKey = JSON.stringify(layout);
  const showBoxes = debug?.showBoxes, showUnits = debug?.showUnits, showCollisions = debug?.showCollisions;
  useEffect(() => {
    const element = host.current!;
    const instance = new KanbunViewer(element, {
      source: '',
      onLayout: result => callbacks.current.onLayout?.(result),
      onError: error => callbacks.current.onError?.(error),
    });
    viewer.current = instance;
    return () => {
      instance.destroy();
      element.replaceChildren();
      viewer.current = null;
    };
  }, []);
  useEffect(() => {
    const config: ViewerOptions = {
      source, layout: JSON.parse(layoutKey) as Partial<LayoutOptions>,
      debug: { showBoxes, showUnits, showCollisions }, autoColumnHeight,
      onLayout: result => callbacks.current.onLayout?.(result),
      onError: error => callbacks.current.onError?.(error),
    };
    viewer.current?.setConfig(config);
  }, [source, layoutKey, showBoxes, showUnits, showCollisions, autoColumnHeight]);

  return <div {...attributes} ref={host} />;
}
