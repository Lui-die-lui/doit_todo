"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MdDragIndicator } from "react-icons/md";
import { archivePlanAction, type ReorderPlansResult } from "@/lib/actions/plans";

/** How long after a drag ends a click is still treated as the tail of that drag. The stray
 * click fires within a few ms of the pointer release; this leaves generous headroom without
 * ever swallowing a real, deliberate click. */
const CLICK_AFTER_DRAG_GUARD_MS = 150;

export type PlanGridItem = {
  id: number;
  title: string;
  /** Archived plans stay in the list but can't be reordered, edited or deleted again. */
  archived: boolean;
  /** The server-rendered card (a single link) -- this component only adds drag + menu around it. */
  card: ReactNode;
};

/**
 * The /plans card grid: drag a card to reorder (saved through `reorderAction`, so the home
 * carousel follows). Each active card carries a six-dot grip in its corner that is both the
 * drag handle and the button for an edit / delete menu: a plain click opens the menu, pressing
 * and dragging moves the card. Order is optimistic -- the grid moves at once and snaps back
 * with a message if the save fails.
 */
export function PlanSortableGrid({
  items,
  reorderAction,
}: {
  items: PlanGridItem[];
  reorderAction: (orderedIds: number[]) => Promise<ReorderPlansResult>;
}) {
  const activeItems = useMemo(() => items.filter((item) => !item.archived), [items]);
  const archivedItems = useMemo(() => items.filter((item) => item.archived), [items]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  // Re-sync whenever the server hands back a different order (after a save, an edit, a new plan).
  const serverOrderKey = activeItems.map((item) => item.id).join(",");
  const [order, setOrder] = useState<number[]>(() => activeItems.map((item) => item.id));
  useEffect(() => {
    setOrder(serverOrderKey ? serverOrderKey.split(",").map(Number) : []);
  }, [serverOrderKey]);

  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Letting go of a dragged card ends with a click on whatever is under the pointer -- the
  // card's own link, or the grip button. dnd-kit swallows that click for React handlers but
  // that leaves the link's default action (navigation) free to run, so the card would open
  // right after being moved. This guard registers first (before dnd-kit adds its own), sees
  // the click first, and cancels it outright: during a drag and for a beat afterwards.
  const dragging = useRef(false);
  const dragEndedAt = useRef(0);
  useEffect(() => {
    const swallowClickAfterDrag = (event: MouseEvent) => {
      if (dragging.current || performance.now() - dragEndedAt.current < CLICK_AFTER_DRAG_GUARD_MS) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", swallowClickAfterDrag, true);
    return () => document.removeEventListener("click", swallowClickAfterDrag, true);
  }, []);

  const sensors = useSensors(
    // A click must still open the card (or the grip's menu): dragging only starts after the
    // pointer has moved a bit.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // On touch, a short press-and-hold picks a card up so normal scrolling keeps working.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  function handleDragStart() {
    dragging.current = true;
  }

  function handleDragCancel() {
    dragging.current = false;
    dragEndedAt.current = performance.now();
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    dragging.current = false;
    dragEndedAt.current = performance.now();
    if (!over || active.id === over.id) return;
    const from = order.indexOf(Number(active.id));
    const to = order.indexOf(Number(over.id));
    if (from < 0 || to < 0) return;

    const previous = order;
    const next = arrayMove(order, from, to);
    setOrder(next);
    setMessage(null);
    startTransition(async () => {
      const result = await reorderAction(next);
      if (!result.ok) {
        setOrder(previous);
        setMessage(result.message);
      }
    });
  }

  return (
    <>
      <DndContext
        id="plan-sortable-grid"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {order.map((id) => {
              const item = itemById.get(id);
              return item ? <SortablePlanItem key={id} item={item} disabled={isPending} /> : null;
            })}
            {archivedItems.map((item) => (
              <li key={item.id} data-plan-id={item.id} className="relative opacity-50">
                {item.card}
              </li>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-ink-500">
        {message}
      </p>
    </>
  );
}

function SortablePlanItem({ item, disabled }: { item: PlanGridItem; disabled: boolean }) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled });

  return (
    <li
      ref={setNodeRef}
      data-plan-id={item.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative select-none ${isDragging ? "z-20 cursor-grabbing opacity-90 shadow-[0_16px_36px_-12px_rgba(17,17,15,0.35)] [&_*]:!cursor-grabbing" : ""}`}
      {...listeners}
    >
      {item.card}
      <PlanCardMenu planId={item.id} title={item.title} />
    </li>
  );
}

const MENU_ITEM_CLASSNAME =
  "block w-full px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-ink-900/[0.06] hover:text-ink-900 focus-visible:bg-ink-900/[0.06] focus-visible:outline-none";

function PlanCardMenu({ planId, title }: { planId: number; title: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Capture phase, so a press anywhere outside closes the menu even where something else
    // (the open menu's own drag guard, another card's grip) handles that pointer event.
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Pressing on the open menu's items must never start a card drag (the grip button itself
  // is the one place a press here *should* reach the card's drag listeners).
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

  return (
    <div ref={containerRef} className="absolute right-2 top-2 z-10">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${title} 계획 메뉴 (끌어서 순서 변경)`}
        title="누르면 메뉴 · 끌어서 순서 변경"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        // touch-none: a finger on the grip drags the card instead of scrolling the page.
        className="flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-900/[0.06] hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/25 aria-expanded:bg-ink-900/[0.08] aria-expanded:text-ink-900"
      >
        <MdDragIndicator aria-hidden="true" size={20} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`${title} 계획 메뉴`}
          onPointerDown={stop}
          onMouseDown={stop}
          onTouchStart={stop}
          className="absolute right-0 top-9 z-30 w-32 overflow-hidden rounded-md border border-line-strong bg-surface py-1 shadow-[0_12px_28px_-10px_rgba(17,17,15,0.3)]"
        >
          <Link
            href={`/plans/${planId}/edit`}
            role="menuitem"
            draggable={false}
            className={MENU_ITEM_CLASSNAME}
          >
            수정
          </Link>
          <form action={archivePlanAction}>
            <input type="hidden" name="planId" value={planId} />
            <button
              type="submit"
              role="menuitem"
              className={MENU_ITEM_CLASSNAME}
              onClick={(event) => {
                if (
                  !window.confirm(
                    `'${title}' 계획을 삭제할까요?\n메인 화면에서는 사라지고, 계획 목록에는 보관된 상태(흐리게)로 남습니다.`,
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              삭제
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
