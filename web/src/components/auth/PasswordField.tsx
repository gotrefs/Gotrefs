"use client";

import { forwardRef, useId, useState } from "react";

type PasswordFieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: string;
  labelClassName?: string;
  inputClassName?: string;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    {
      label,
      labelClassName = "block text-sm font-bold text-[var(--navy)]",
      inputClassName = "w-full rounded-xl border border-slate-200 py-3 pl-4 pr-14 outline-none transition focus:border-[var(--navy)] focus:ring-2 focus:ring-[var(--navy)]/10",
      className,
      id,
      ...inputProps
    },
    ref
  ) {
    const [visible, setVisible] = useState(false);
    const generatedId = useId();
    const inputId = id ?? inputProps.name ?? generatedId;

    return (
      <div className={labelClassName}>
        <label htmlFor={inputId} className="block">
          {label}
        </label>
        <div className={`relative mt-2 ${className ?? ""}`}>
          <input
            {...inputProps}
            id={inputId}
            ref={ref}
            type={visible ? "text" : "password"}
            className={inputClassName}
          />
          <button
            type="button"
            onMouseDown={(event) => {
              // Keep focus in the field; don't let the button steal/blur mid-toggle.
              event.preventDefault();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setVisible((current) => !current);
            }}
            className="absolute inset-y-0 right-1 my-1 flex items-center rounded-lg px-3 text-xs font-black uppercase tracking-wide text-[var(--navy)] transition hover:bg-slate-100"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
      </div>
    );
  }
);
