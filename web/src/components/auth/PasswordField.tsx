"use client";

import { forwardRef, useState } from "react";

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
      inputClassName = "w-full rounded-xl border border-slate-200 py-3 pl-4 pr-12 outline-none transition focus:border-[var(--navy)] focus:ring-2 focus:ring-[var(--navy)]/10",
      className,
      id,
      ...inputProps
    },
    ref
  ) {
    const [visible, setVisible] = useState(false);
    const inputId = id ?? inputProps.name ?? "password";

    return (
      <label className={labelClassName} htmlFor={inputId}>
        {label}
        <span className={`relative mt-2 block ${className ?? ""}`}>
          <input
            {...inputProps}
            id={inputId}
            ref={ref}
            type={visible ? "text" : "password"}
            className={inputClassName}
          />
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-bold uppercase tracking-wide text-[var(--muted)] transition hover:text-[var(--navy)]"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            tabIndex={-1}
          >
            {visible ? "Hide" : "Show"}
          </button>
        </span>
      </label>
    );
  }
);
