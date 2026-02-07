"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { getProxyImageUrl } from "@/lib/proxy-image";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type StripItem = {
  id: string;
  imageUrl: string;
  albumName: string;
  artistName: string | null;
};

type Props = {
  items: StripItem[];
  activeId: string | null;
  onSelect: (item: StripItem) => void;
  /** 传入时显示删除按钮 */
  onDelete?: (item: StripItem) => void;
  /** 传入时启用拖动排序，回调新的顺序 */
  onReorder?: (items: StripItem[]) => void;
};

function SortableStripItem({
  item,
  activeId,
  onSelect,
  onDelete,
}: {
  item: StripItem;
  activeId: string | null;
  onSelect: (item: StripItem) => void;
  onDelete?: (item: StripItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isDragging ? "grabbing" : "grab",
  };

  const isActive = item.id === activeId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative shrink-0 ${isActive ? "z-[100]" : ""}`}
      data-strip-id={item.id}
    >
      <motion.div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(item)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(item);
          }
        }}
        className={`relative overflow-visible rounded-xl transition-shadow focus:outline-none cursor-grab ${
          isActive
            ? "ring-2 ring-gray-800/40 shadow-lg"
            : "ring-1 ring-black/5 shadow-md hover:shadow-lg"
        } ${isDragging ? "opacity-90 shadow-xl z-10 cursor-grabbing" : ""}`}
        animate={{ scale: isActive ? 1.5 : 1 }}
        whileHover={isDragging ? undefined : { scale: isActive ? 1.5 : 1.06 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        {...attributes}
        {...listeners}
      >
        <div className="relative h-12 w-12 sm:h-20 sm:w-20 overflow-hidden rounded-xl">
          <img
            src={getProxyImageUrl(item.imageUrl)}
            alt={item.albumName}
            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
            referrerPolicy="no-referrer"
            draggable={false}
          />
        </div>
        {onDelete && (
          <div
            className="absolute -top-1 -right-1 z-10 p-1.5 group/delete"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
              className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-transparent text-white text-xs leading-none opacity-0 transition-opacity hover:bg-black/20 group-hover/delete:opacity-100"
              aria-label={`删除 ${item.albumName}`}
            >
              &times;
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function AlbumStrip({ items, activeId, onSelect, onDelete, onReorder }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!activeId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(
      `[data-strip-id="${activeId}"]`
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!onReorder || !over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  if (items.length === 0) return null;

  const content = (
    <div
      ref={scrollRef}
      className="flex items-center gap-3 overflow-x-auto overflow-y-visible min-h-28 sm:min-h-40 px-4 py-4 sm:gap-4 sm:px-8 sm:py-6 scroll-touch"
    >
      {items.map((item) => (
        <SortableStripItem
          key={item.id}
          item={item}
          activeId={activeId}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      ))}
    </div>
  );

  if (onReorder) {
    return (
      <div className="album-strip">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={horizontalListSortingStrategy}
          >
            {content}
          </SortableContext>
        </DndContext>
      </div>
    );
  }

  return <div className="album-strip">{content}</div>;
}
