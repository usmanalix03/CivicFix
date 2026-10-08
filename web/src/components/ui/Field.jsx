const inputBase =
  'w-full rounded-2xl border-0 bg-gray-100 px-4 py-3.5 text-gray-900 outline-none ring-1 ring-inset ring-transparent transition-all placeholder:text-gray-500 hover:bg-gray-200 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:bg-slate-700/50 dark:text-white dark:placeholder:text-gray-400 dark:hover:bg-slate-700 dark:focus:bg-slate-800 dark:focus:ring-blue-500';

function Label({ htmlFor, label }) {
  if (!label) return null;
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-sm font-semibold text-gray-900 dark:text-gray-300"
    >
      {label}
    </label>
  );
}

function Hint({ error, hint }) {
  if (!error && !hint) return null;
  return (
    <p
      className={`mt-1.5 text-xs ${
        error ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
      }`}
    >
      {error || hint}
    </p>
  );
}

export function Input({ id, label, error, hint, className = '', ...props }) {
  return (
    <div>
      <Label htmlFor={id} label={label} />
      <input id={id} className={`${inputBase} ${className}`} {...props} />
      <Hint error={error} hint={hint} />
    </div>
  );
}

export function Textarea({ id, label, error, hint, className = '', rows = 4, ...props }) {
  return (
    <div>
      <Label htmlFor={id} label={label} />
      <textarea id={id} rows={rows} className={`${inputBase} resize-none ${className}`} {...props} />
      <Hint error={error} hint={hint} />
    </div>
  );
}

export function Select({ id, label, error, hint, className = '', options = [], ...props }) {
  return (
    <div>
      <Label htmlFor={id} label={label} />
      <select id={id} className={`${inputBase} cursor-pointer ${className}`} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <Hint error={error} hint={hint} />
    </div>
  );
}
