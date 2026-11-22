import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import { Trash2, MoveHorizontal, ExternalLink } from 'lucide-react';

const PRESET_WIDTHS = ['25%', '50%', '75%', '100%'];

export const ResizableImageView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  selected,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState<string>(node.attrs.width || '100%');
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  useEffect(() => {
    if (node.attrs.width) {
      setCurrentWidth(node.attrs.width);
    }
  }, [node.attrs.width]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;

    if (containerRef.current) {
      startWidthRef.current = containerRef.current.offsetWidth;
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startXRef.current;
      const parentWidth = containerRef.current?.parentElement?.offsetWidth || 800;
      const newWidthPx = Math.max(120, Math.min(parentWidth, startWidthRef.current + deltaX));
      const widthPct = Math.round((newWidthPx / parentWidth) * 100);
      const clampedPct = `${Math.min(100, Math.max(15, widthPct))}%`;
      setCurrentWidth(clampedPct);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      updateAttributes({ width: currentWidth });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [currentWidth, updateAttributes]);

  const setPresetWidth = (preset: string) => {
    setCurrentWidth(preset);
    updateAttributes({ width: preset });
  };

  const openOriginal = () => {
    if (node.attrs.src) {
      window.open(node.attrs.src, '_blank');
    }
  };

  return (
    <NodeViewWrapper
      className="my-4 flex flex-col items-center justify-center select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        ref={containerRef}
        className={`vault-resizable-image relative group rounded-2xl transition-all duration-150 ${
          selected || isResizing ? 'ring-2 ring-[var(--accent-primary)] shadow-2xl' : ''
        }`}
        style={{ width: currentWidth, maxWidth: '100%' }}
      >
        <img
          src={node.attrs.src}
          alt={node.attrs.alt || 'Pasted Note Image'}
          className="w-full h-auto object-cover rounded-xl shadow-lg border border-[var(--border-default)]"
          draggable={false}
        />

        {/* Floating Quick Action Overlay on Hover or Selected */}
        {(isHovered || selected || isResizing) && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 p-1 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 shadow-xl z-20">
            {PRESET_WIDTHS.map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setPresetWidth(preset)}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-lg transition-all ${
                  currentWidth === preset
                    ? 'bg-[var(--accent-primary)] text-black shadow-sm'
                    : 'text-zinc-300 hover:text-white hover:bg-white/15'
                }`}
              >
                {preset}
              </button>
            ))}

            <div className="w-[1px] h-3 bg-white/20 mx-0.5" />

            <button
              type="button"
              onClick={openOriginal}
              title="Open full size"
              className="p-1 rounded-md text-zinc-300 hover:text-white hover:bg-white/15 transition-colors"
            >
              <ExternalLink size={12} />
            </button>

            <button
              type="button"
              onClick={deleteNode}
              title="Remove image"
              className="p-1 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}

        {/* Drag Resize Handle at Bottom-Right & Right */}
        {(isHovered || selected || isResizing) && (
          <div
            onMouseDown={handleMouseDown}
            className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-8 rounded-full bg-[var(--accent-primary)] text-black cursor-ew-resize flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 z-30"
            title="Drag horizontally to resize"
          >
            <MoveHorizontal size={10} className="stroke-[3]" />
          </div>
        )}

        {/* Display Current Width during active resizing */}
        {isResizing && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/85 backdrop-blur-md text-[11px] font-mono font-bold text-white border border-white/15 shadow-xl z-30">
            {currentWidth}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const ResizableImage = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: '100%',
        renderHTML: attributes => {
          return {
            width: attributes.width,
            style: `width: ${attributes.width}; max-width: 100%; border-radius: 0.75rem;`,
          };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

