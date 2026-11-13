import React from 'react';

export default function PageHeader({ title, description, actions, icon: Icon }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
          {Icon ? <Icon className="h-5 w-5 text-admin-accent" /> : null}
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-admin-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
