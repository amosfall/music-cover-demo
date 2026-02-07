"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type AlbumItem = {
  id: string;
  imageUrl: string;
  albumName: string;
  artistName: string | null;
};

const CHECKERBOARD_BG = "linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee), linear-gradient(45deg, #eee 25%, white 25%, white 75%, #eee 75%, #eee)";
const CHECKERBOARD_SIZE = "20px 20px";
const CHECKERBOARD_POS = "0 0, 10px 10px";

type Props = {
  ratio: "1:1" | "4:3";
  isTransparent?: boolean;
  title?: string;
  slogan?: string;
  addTitleTrigger?: number;
  addDateTrigger?: number;
  addSloganTrigger?: number;
  categoryId?: string | null;
};

type Pos = { left: number; top: number };

const EXPORT_SIZE = 1080;
const CARD_W = 280;
const CARD_H = 368;
const PADDING = 60;
const GRID_TIGHTEN = 0.68;
const FOOTER_BOTTOM = 30;

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function hashToUnit(h: number): number {
  return (h % 10000) / 10000;
}

type CardStyle = { top: string; left: string; transform: string; zIndex: number };

function formatDate(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function getImageSrc(url: string, uniqueId: string): string {
  if (!url) return "";
  const base = getProxyImageUrl(url);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}_id=${encodeURIComponent(uniqueId)}`;
}

/* SortablePolaroid：封装单张专辑，合并 dnd-kit transform 与网格旋转 */
function SortablePolaroid({
  item,
  cardStyle,
}: {
  item: AlbumItem;
  cardStyle: CardStyle;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const baseTransform = cardStyle.transform;
  const mergedTransform = transform
    ? `${CSS.Transform.toString(transform)} ${baseTransform}`
    : baseTransform;

  const style: React.CSSProperties = {
    position: "absolute",
    top: cardStyle.top,
    left: cardStyle.left,
    transform: mergedTransform,
    transition,
    zIndex: isDragging ? 999 : cardStyle.zIndex,
    cursor: isDragging ? "grabbing" : "grab",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  return (
    <div
      ref={setNodeRef}
      className="polaroid-card"
      style={style}
      {...attributes}
      {...listeners}
    >
      <div className="polaroid-img-wrap">
        <img
          src={getImageSrc(item.imageUrl, item.id)}
          alt={item.albumName}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          style={{ WebkitUserDrag: "none" } as React.CSSProperties}
        />
      </div>
      <div className="polaroid-caption">
        <div>{item.albumName}</div>
        {item.artistName && (
          <div className="polaroid-artist">{item.artistName}</div>
        )}
      </div>
    </div>
  );
}

export default function PolaroidPoster({
  ratio,
  isTransparent = false,
  title: titleProp = "",
  slogan: sloganProp = "",
  addTitleTrigger,
  addDateTrigger,
  addSloganTrigger,
  categoryId,
}: Props) {
  const [items, setItems] = useState<AlbumItem[]>([]);
  const [orderedList, setOrderedList] = useState<AlbumItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardStyles, setCardStyles] = useState<CardStyle[]>([]);
  const [title, setTitle] = useState(titleProp);
  const [slogan, setSlogan] = useState(sloganProp);
  const [dateStr, setDateStr] = useState("");
  const [titlePos, setTitlePos] = useState<Pos>({ left: 50, top: 82 });
  const [sloganPos, setSloganPos] = useState<Pos>({ left: 50, top: 94 });
  const [datePos, setDatePos] = useState<Pos>({ left: 50, top: 90 });
  const [editing, setEditing] = useState<"title" | "slogan" | "date" | null>(null);
  const dragRef = useRef<{
    el: "title" | "slogan" | "date";
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = categoryId
      ? `/api/albums?categoryId=${encodeURIComponent(categoryId)}`
      : "/api/albums";
    fetch(url, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setItems(arr);
        const seen = new Set<string>();
        const filtered = arr.filter((item: AlbumItem) => {
          if (seen.has(item.albumName)) return false;
          seen.add(item.albumName);
          return true;
        });
        setOrderedList(filtered);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [categoryId]);

  useEffect(() => {
    if (addTitleTrigger != null && addTitleTrigger > 0) setEditing("title");
  }, [addTitleTrigger]);
  useEffect(() => {
    if (addDateTrigger != null && addDateTrigger > 0) setEditing("date");
  }, [addDateTrigger]);
  useEffect(() => {
    if (addSloganTrigger != null && addSloganTrigger > 0) setEditing("slogan");
  }, [addSloganTrigger]);

  const list = orderedList;
  const listKey = list.map((x) => x.id).join(",");

  useEffect(() => {
    if (list.length === 0) return;
    const N = list.length;
    const cols = Math.ceil(Math.sqrt(N));
    const rows = Math.ceil(N / cols);

    const is1x1 = ratio === "1:1";
    const contentW = EXPORT_SIZE - PADDING * 2;
    const contentH =
      (is1x1 ? EXPORT_SIZE : Math.round(EXPORT_SIZE * 0.75)) - PADDING * 2;
    const zoneW = contentW;
    const zoneH = contentH - 80;
    const cellW = (zoneW / cols) * GRID_TIGHTEN;
    const cellH = (zoneH / rows) * GRID_TIGHTEN;
    const offsetX = (zoneW - cols * cellW) / 2;
    const offsetY = (zoneH - rows * cellH) / 2;

    const styles: CardStyle[] = list.map((item, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const centerX = offsetX + (col + 0.5) * cellW;
      const centerY = offsetY + (row + 0.5) * cellH;
      const h1 = hashStr(item.id + String(i));
      const h2 = hashStr(item.id + String(i + 100));
      const jitterX = (hashToUnit(h1) * 2 - 1) * 0.1 * cellW;
      const jitterY = (hashToUnit(h2) * 2 - 1) * 0.1 * cellH;
      const leftPx = centerX - CARD_W / 2 + jitterX;
      const topPx = centerY - CARD_H / 2 + jitterY;
      const leftPct = (leftPx / zoneW) * 100;
      const topPct = (topPx / zoneH) * 100;
      const rot = -15 + (hashStr(item.id + String(i + 200)) % 31);
      return {
        top: `${topPct}%`,
        left: `${leftPct}%`,
        transform: `rotate(${rot}deg)`,
        zIndex: i,
      };
    });
    setCardStyles(styles);
  }, [listKey, list.length, ratio]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedList((prev) => {
      const oldIndex = prev.findIndex((x) => x.id === active.id);
      const newIndex = prev.findIndex((x) => x.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const movedRef = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, el: "title" | "slogan" | "date") => {
      if (
        (e.target as HTMLElement).closest("button") ||
        (e.target as HTMLElement).closest("input")
      )
        return;
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      movedRef.current = false;
      const pos =
        el === "title" ? titlePos : el === "slogan" ? sloganPos : datePos;
      dragRef.current = {
        el,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: pos.left,
        startTop: pos.top,
      };

      const onMove = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const dx = ((ev.clientX - d.startX) / rect.width) * 100;
        const dy = ((ev.clientY - d.startY) / rect.height) * 100;
        const left = Math.max(0, Math.min(100, d.startLeft + dx));
        const top = Math.max(0, Math.min(100, d.startTop + dy));
        movedRef.current = true;
        if (d.el === "title") setTitlePos({ left, top });
        else if (d.el === "slogan") setSloganPos({ left, top });
        else setDatePos({ left, top });
      };
      const onUp = (ev: PointerEvent) => {
        target.releasePointerCapture(ev.pointerId);
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onUp);
        const d = dragRef.current;
        if (!d) return;
        const wasClick = !movedRef.current;
        dragRef.current = null;
        if (wasClick) setEditing(d.el);
      };
      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp, { once: true });
    },
    [titlePos, sloganPos, datePos]
  );

  const is1x1 = ratio === "1:1";
  const containerW = is1x1 ? EXPORT_SIZE : EXPORT_SIZE;
  const containerH = is1x1 ? EXPORT_SIZE : Math.round(EXPORT_SIZE * 0.75);

  const containerStyle: React.CSSProperties = {
    width: containerW,
    height: containerH,
    backgroundColor: isTransparent ? "transparent" : "#dcd7c9",
    ...(isTransparent
      ? {
          backgroundImage: CHECKERBOARD_BG,
          backgroundSize: CHECKERBOARD_SIZE,
          backgroundPosition: CHECKERBOARD_POS,
        }
      : {}),
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    padding: PADDING,
    boxSizing: "border-box",
  };

  if (loading) {
    return (
      <div
        id="polaroid-export-container"
        style={containerStyle}
        className={`polaroid-poster-root${isTransparent ? " is-transparent" : ""}`}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            color: "#666",
          }}
        >
          加载中...
        </div>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div
        id="polaroid-export-container"
        style={containerStyle}
        className={`polaroid-poster-root${isTransparent ? " is-transparent" : ""}`}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            color: "#666",
          }}
        >
          暂无专辑，先添加一些吧
        </div>
      </div>
    );
  }

  const contentW = EXPORT_SIZE - PADDING * 2;
  const contentH =
    (is1x1 ? EXPORT_SIZE : Math.round(EXPORT_SIZE * 0.75)) - PADDING * 2;
  const zoneW = contentW;
  const zoneH = contentH - 80;

  const sortableIds = list.map((x) => x.id);

  return (
    <div
      id="polaroid-export-container"
        style={containerStyle}
        className={`polaroid-poster-root${isTransparent ? " is-transparent" : ""}`}
      >
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: zoneW,
          height: zoneH + 80,
          flexShrink: 0,
        }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
            <div
              className="poster-photo-zone"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: zoneW,
                height: zoneH,
              }}
            >
              {list.map((item, i) => {
                const style =
                  cardStyles[i] ?? {
                    top: "0%",
                    left: "0%",
                    transform: "rotate(0deg)",
                    zIndex: i,
                  };
                return (
                  <SortablePolaroid
                    key={item.id}
                    item={item}
                    cardStyle={style}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
        {(title || editing === "title") && (
          <div
            className="poster-title"
            style={{
              position: "absolute",
              left: titlePos.left + "%",
              top: titlePos.top + "%",
              transform: "translate(-50%, -50%)",
              cursor: "grab",
              userSelect: "none",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                position: "relative",
                display: "inline-block",
                touchAction: "none",
              }}
              onPointerDown={(e) => handlePointerDown(e, "title")}
            >
              {editing === "title" ? (
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => setEditing(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setTitle("音乐浮墙");
                      setEditing(null);
                    } else if (e.key === "Escape") setEditing(null);
                  }}
                  style={{
                    fontSize: "inherit",
                    fontWeight: "inherit",
                    textAlign: "center",
                    width: 200,
                    border: "1px solid #999",
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ) : (
                title
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setTitle("");
                  setEditing(null);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                title="删除"
                data-hide-on-export
                style={{
                  position: "absolute",
                  top: -12,
                  right: -24,
                  width: 20,
                  height: 20,
                  padding: 0,
                  fontSize: 14,
                  lineHeight: 1,
                  cursor: "pointer",
                  background: "rgba(0,0,0,0.1)",
                  border: "none",
                  borderRadius: "50%",
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}
        {(dateStr || editing === "date") && (
          <div
            className="poster-footer"
            style={{
              position: "absolute",
              left: datePos.left + "%",
              top: datePos.top + "%",
              transform: "translate(-50%, -50%)",
              cursor: "grab",
              userSelect: "none",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                position: "relative",
                display: "inline-block",
                touchAction: "none",
              }}
              onPointerDown={(e) => handlePointerDown(e, "date")}
            >
              {editing === "date" ? (
                <input
                  autoFocus
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  onBlur={() => setEditing(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setDateStr(formatDate(new Date()));
                      setEditing(null);
                    } else if (e.key === "Escape") {
                      setEditing(null);
                    }
                  }}
                  style={{
                    fontSize: "inherit",
                    textAlign: "center",
                    width: 120,
                    border: "1px solid #999",
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ) : (
                dateStr
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDateStr("");
                  setEditing(null);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                title="删除"
                data-hide-on-export
                style={{
                  position: "absolute",
                  top: -12,
                  right: -24,
                  width: 20,
                  height: 20,
                  padding: 0,
                  fontSize: 14,
                  lineHeight: 1,
                  cursor: "pointer",
                  background: "rgba(0,0,0,0.1)",
                  border: "none",
                  borderRadius: "50%",
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}
        {(slogan || editing === "slogan") && (
          <div
            className="poster-slogan"
            style={{
              position: "absolute",
              left: sloganPos.left + "%",
              top: sloganPos.top + "%",
              transform: "translate(-50%, -50%)",
              cursor: "grab",
              userSelect: "none",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                position: "relative",
                display: "inline-block",
                touchAction: "none",
              }}
              onPointerDown={(e) => handlePointerDown(e, "slogan")}
            >
              {editing === "slogan" ? (
                <input
                  autoFocus
                  value={slogan}
                  onChange={(e) => setSlogan(e.target.value)}
                  onBlur={() => setEditing(null)}
                  onKeyDown={(e) => {
                    e.key === "Enter" && setEditing(null);
                    e.key === "Escape" && setEditing(null);
                  }}
                  style={{
                    fontSize: "inherit",
                    textAlign: "center",
                    width: 180,
                    border: "1px solid #999",
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ) : (
                slogan
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setSlogan("");
                  setEditing(null);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                title="删除"
                data-hide-on-export
                style={{
                  position: "absolute",
                  top: -12,
                  right: -24,
                  width: 20,
                  height: 20,
                  padding: 0,
                  fontSize: 14,
                  lineHeight: 1,
                  cursor: "pointer",
                  background: "rgba(0,0,0,0.1)",
                  border: "none",
                  borderRadius: "50%",
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
