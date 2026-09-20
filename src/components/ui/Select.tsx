"use client";

import * as RadixSelect from "@radix-ui/react-select";

export type SelectOption = { value: string; label: string; disabled?: boolean };
export type SelectGroup = { label: string; options: SelectOption[] };
export type SelectItemDef = SelectOption | SelectGroup;

export type SelectSize = "sm" | "md" | "lg" | "full" | "auto";
/** "field" is the bordered 42px form control; "inline" is a compact borderless trigger for use inside another panel (e.g. the calendar header). */
export type SelectVariant = "field" | "inline";

// Below the sm breakpoint every size collapses to full width so filter bars stack
// or wrap instead of squeezing several dropdowns into one row.
const SIZE_CLASS: Record<SelectSize, string> = {
  sm: "w-full sm:w-[140px]",
  md: "w-full sm:w-[190px]",
  lg: "w-full sm:w-[260px]",
  full: "w-full",
  auto: "w-auto",
};

export type SelectProps = {
  /** Flat options and/or labelled groups. Values must be non-empty strings. */
  options: SelectItemDef[];
  /** Submitted with the surrounding <form> (FormData / GET query), exactly like a native select. */
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  size?: SelectSize;
  variant?: SelectVariant;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

// A disabled stand-in row so an empty list opens a readable menu instead of a blank box.
const EMPTY_VALUE = "__doit-select-empty__";

function isGroup(item: SelectItemDef): item is SelectGroup {
  return "options" in item;
}

function Chevron({ direction = "down" }: { direction?: "up" | "down" }) {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={direction === "up" ? "rotate-180" : undefined}
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  );
}

// `focus-visible:outline-none` (not just `outline-none`): globals.css sets a 2px outline on every
// :focus-visible, and that rule comes after Tailwind's utilities, so it would otherwise draw a ring
// around the black highlighted row.
// The row itself is the one-line ellipsis box (block + leading-10 = 40px): Radix's ItemText drops
// className/style, so truncation can't live on the text element.
const ITEM_CLASS =
  "block h-10 cursor-pointer select-none truncate px-3.5 text-[13px] leading-10 text-ink-900 outline-none focus-visible:outline-none " +
  "data-[state=checked]:font-semibold data-[highlighted]:bg-ink-900 data-[highlighted]:text-white " +
  "data-[disabled]:cursor-not-allowed data-[disabled]:text-ink-400 data-[disabled]:data-[highlighted]:bg-transparent data-[disabled]:data-[highlighted]:text-ink-400";

function Item({ option }: { option: SelectOption }) {
  return (
    <RadixSelect.Item value={option.value} disabled={option.disabled} className={ITEM_CLASS}>
      <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
    </RadixSelect.Item>
  );
}

export function Select({
  options,
  name,
  id,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  disabled,
  required,
  size = "md",
  variant = "field",
  className = "",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: SelectProps) {
  const isEmpty = options.every((item) => (isGroup(item) ? item.options.length === 0 : false));

  return (
    // `relative` anchors Radix's visually-hidden native control (the one that carries
    // name/value/required into the form) to the trigger, so a native "required" bubble
    // points at the visible control instead of the top of the page.
    <div className={`relative inline-block max-w-full ${SIZE_CLASS[size]} ${className}`}>
      <RadixSelect.Root
        name={name}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
        required={required}
      >
        <RadixSelect.Trigger
          id={id}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          className={
            "group flex w-full cursor-pointer items-center justify-between text-left text-ink-900 " +
            (variant === "inline"
              ? "h-10 gap-1.5 border border-transparent bg-transparent px-2 text-[15px] font-semibold hover:border-line-strong data-[state=open]:border-ink-900 "
              : "h-[42px] gap-3 border border-line-strong bg-surface px-3.5 text-sm hover:border-ink-900 data-[state=open]:border-ink-900 ") +
            "transition-colors duration-150 " +
            "data-[placeholder]:text-ink-400 " +
            "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ink-900 " +
            "disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-muted disabled:text-ink-400 disabled:hover:border-line " +
            "aria-[invalid=true]:border-ink-900"
          }
        >
          <span className="min-w-0 flex-1 truncate">
            <RadixSelect.Value placeholder={placeholder} />
          </span>
          <RadixSelect.Icon asChild>
            <span className="inline-flex shrink-0 text-ink-500 transition-transform duration-150 group-data-[state=open]:rotate-180">
              <Chevron />
            </span>
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={5}
            collisionPadding={8}
            // Width is pinned to the trigger (min = max = width) so the menu always lines up with
            // the field, whatever the longest option is; long labels ellipsize instead of widening it.
            className="doit-select-content z-[100] flex max-h-[min(280px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)] flex-col overflow-hidden border border-[#1a1a1a] bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
          >
            <RadixSelect.ScrollUpButton className="flex h-6 shrink-0 cursor-default items-center justify-center text-ink-500">
              <Chevron direction="up" />
            </RadixSelect.ScrollUpButton>
            <RadixSelect.Viewport className="w-full">
              {isEmpty && <Item option={{ value: EMPTY_VALUE, label: "선택할 항목이 없습니다", disabled: true }} />}
              {options.map((item, i) =>
                isGroup(item) ? (
                  <RadixSelect.Group key={`${item.label}-${i}`}>
                    <RadixSelect.Label className="label-coord truncate px-3.5 pb-1 pt-2 text-[10px] text-ink-400">
                      {item.label}
                    </RadixSelect.Label>
                    {item.options.map((o) => (
                      <Item key={o.value} option={o} />
                    ))}
                  </RadixSelect.Group>
                ) : (
                  <Item key={item.value} option={item} />
                ),
              )}
            </RadixSelect.Viewport>
            <RadixSelect.ScrollDownButton className="flex h-6 shrink-0 cursor-default items-center justify-center text-ink-500">
              <Chevron />
            </RadixSelect.ScrollDownButton>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  );
}
