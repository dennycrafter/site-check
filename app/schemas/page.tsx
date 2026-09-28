'use client';

import { useEffect, useState } from 'react';
import {
  CAPTURE_STEPS,
  DOCUMENTS,
  FIELD_GROUPS,
  GROUP_LABEL,
  INDEXES,
  PHOTO_FIELDS,
  TABLES,
  columnKey,
  findColumn,
  type DocumentSchema,
  type NamedValue,
  type PhotoField,
  type SchemaNode,
  type SqlColumn,
  type ViewId,
} from './data';

const VIEWS: { id: ViewId; label: string; count: string }[] = [
  { id: 'fields', label: 'Photo fields', count: '27' },
  { id: 'tables', label: 'Stored tables', count: '2' },
  { id: 'documents', label: 'JSON documents', count: '4' },
];

export default function SchemasPage() {
  const [view, setView] = useState<ViewId>('fields');
  const [fieldName, setFieldName] = useState('setup_type');
  const [stepId, setStepId] = useState<string | null>('meter_area_wide');
  const [columnId, setColumnId] = useState('photos.analysis');
  const [documentId, setDocumentId] = useState('site_check');

  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.slice(1);
      if (hash === 'fields' || hash === 'tables' || hash === 'documents') setView(hash);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  const choose = (next: ViewId) => {
    setView(next);
    window.history.replaceState(null, '', `#${next}`);
  };

  const jumpFromColumn = (jump: SqlColumn['jump']) => {
    if (!jump) return;
    if (jump.view === 'documents' && jump.documentId) setDocumentId(jump.documentId);
    if (jump.view === 'fields' && jump.label.includes('setup_type')) {
      setFieldName('setup_type');
      setStepId('meter_area_wide');
    }
    choose(jump.view);
  };

  return (
    <main className="sv-shell">
      <header className="sv-header">
        <a className="brand" href="/">
          <span className="base-wordmark">BASE</span>
          <span>
            Schema <em>visualizers</em>
          </span>
        </a>
        <nav>
          <a href="/">Qualification</a>
          <a href="/customer-deck">Customer deck</a>
        </nav>
      </header>

      <div className="sv-page">
        <header className="sv-hero">
          <p className="sv-kicker">SiteCheck data</p>
          <h1>How a home check is shaped.</h1>
          <p>
            The model fills one fixed object per photo. Those readings, plus a few JSON documents, land on two
            tables. The rules engine reads them. It does not invent new fields.
          </p>
        </header>

        <div className="sv-tabs" role="tablist" aria-label="Schema visualizers">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={view === item.id}
              onClick={() => choose(item.id)}
            >
              {item.label}
              <b>{item.count}</b>
            </button>
          ))}
        </div>

        {view === 'fields' && (
          <FieldView
            fieldName={fieldName}
            stepId={stepId}
            onField={setFieldName}
            onStep={setStepId}
          />
        )}
        {view === 'tables' && (
          <TableView columnId={columnId} onColumn={setColumnId} onJump={jumpFromColumn} />
        )}
        {view === 'documents' && <DocumentView documentId={documentId} onDocument={setDocumentId} />}
      </div>
    </main>
  );
}

function FieldView({
  fieldName,
  stepId,
  onField,
  onStep,
}: {
  fieldName: string;
  stepId: string | null;
  onField: (name: string) => void;
  onStep: (id: string | null) => void;
}) {
  const field = PHOTO_FIELDS.find((item) => item.name === fieldName) ?? PHOTO_FIELDS[0];
  const step = CAPTURE_STEPS.find((item) => item.id === stepId) ?? null;
  const every = PHOTO_FIELDS.filter((item) => item.group === 'every');
  const listed = step ? PHOTO_FIELDS.filter((item) => item.steps.includes(step.id)) : [];

  const selectField = (name: string) => {
    const next = PHOTO_FIELDS.find((item) => item.name === name);
    onField(name);
    if (!next || next.group === 'every') {
      onStep(null);
      return;
    }
    if (stepId && !next.steps.includes(stepId)) onStep(next.steps[0] ?? null);
  };

  const selectStep = (id: string) => {
    onStep(id);
    if (field.group !== 'every' && !field.steps.includes(id)) {
      const next = PHOTO_FIELDS.find((item) => item.steps.includes(id));
      if (next) onField(next.name);
    }
  };

  return (
    <div className="sv-split" role="tabpanel">
      <section className="sv-card">
        <div className="sv-card-head">
          <div>
            <h2>Fields by capture step</h2>
            <p>A filled mark means the step lists that field. The model still fills all 27 on every photo.</p>
          </div>
        </div>
        <div className="sv-every">
          <span>Every photo</span>
          <div>
            {every.map((item) => (
              <button
                key={item.name}
                type="button"
                className={field.name === item.name ? 'on' : ''}
                onClick={() => selectField(item.name)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
        <div className="sv-matrix-scroll">
          <table className="sv-matrix">
            <caption>Photo analysis fields by capture step. Source: sitecheck/src/lib/schema.ts and sitecheck/src/lib/steps.ts.</caption>
            <thead>
              <tr>
                <th className="sv-sticky" scope="col">
                  Field
                </th>
                {CAPTURE_STEPS.map((item) => (
                  <th key={item.id} scope="col">
                    <button
                      type="button"
                      className={stepId === item.id ? 'on' : ''}
                      aria-pressed={stepId === item.id}
                      onClick={() => selectStep(item.id)}
                    >
                      {item.short}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELD_GROUPS.map((group) => (
                <GroupRows
                  key={group.id}
                  label={group.label}
                  fields={PHOTO_FIELDS.filter((item) => item.group === group.id)}
                  fieldName={field.name}
                  stepId={stepId}
                  onField={selectField}
                  onCell={(name, id) => {
                    onField(name);
                    onStep(id);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <aside className="sv-inspector" aria-live="polite">
        {step && (
          <section className="sv-block">
            <p className="sv-kicker">Capture step</p>
            <h2>{step.title}</h2>
            <p>{step.instruction}</p>
            <code className="sv-code">{step.slot}</code>
            {step.note && <p className="sv-note">{step.note}</p>}
            <p className="sv-meta">{listed.length} fields listed here</p>
          </section>
        )}
        <FieldDetail field={field} step={step} onStep={selectStep} />
      </aside>
    </div>
  );
}

function GroupRows({
  label,
  fields,
  fieldName,
  stepId,
  onField,
  onCell,
}: {
  label: string;
  fields: PhotoField[];
  fieldName: string;
  stepId: string | null;
  onField: (name: string) => void;
  onCell: (name: string, stepId: string) => void;
}) {
  return (
    <>
      <tr className="sv-group">
        <th className="sv-sticky" scope="rowgroup">
          {label}
        </th>
        {CAPTURE_STEPS.map((step) => (
          <th key={step.id} />
        ))}
      </tr>
      {fields.map((field) => {
        const dim = Boolean(stepId && !field.steps.includes(stepId) && field.name !== fieldName);
        return (
          <tr key={field.name} className={`${field.name === fieldName ? 'is-selected' : ''} ${dim ? 'is-dim' : ''}`}>
            <th className="sv-sticky" scope="row">
              <button type="button" onClick={() => onField(field.name)}>
                <b>{field.name}</b>
                <small>{field.kind}</small>
              </button>
            </th>
            {CAPTURE_STEPS.map((step) => {
              const on = field.steps.includes(step.id);
              return (
                <td key={step.id} className={stepId === step.id ? 'col-on' : ''}>
                  <button
                    type="button"
                    className={on ? 'on' : ''}
                    aria-pressed={field.name === fieldName && stepId === step.id}
                    aria-label={`${field.name} on ${step.title}${on ? ', listed on this step' : ', not listed on this step'}`}
                    onClick={() => onCell(field.name, step.id)}
                  >
                    <i />
                  </button>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

function FieldDetail({
  field,
  step,
  onStep,
}: {
  field: PhotoField;
  step: { id: string; title: string } | null;
  onStep: (id: string) => void;
}) {
  const listedHere = step ? field.steps.includes(step.id) : false;
  return (
    <section className="sv-block">
      <p className="sv-kicker">
        {GROUP_LABEL[field.group]} · field {field.order} of 27
      </p>
      <h2>{field.name}</h2>
      <code className="sv-code">{signature(field)}</code>
      <p>{field.definition}</p>
      {field.values && <ValueList values={field.values} label="Allowed values" />}
      {field.neutral && (
        <p className="sv-meta">
          Neutral when it is not visible: <code>{field.neutral}</code>
        </p>
      )}
      {field.parse && <p className="sv-note">{field.parse}</p>}
      {field.note && <p className="sv-note">{field.note}</p>}
      <p className="sv-kicker sv-gap">Listed on</p>
      {field.steps.length === 0 ? (
        <p className="sv-meta">Every photo. It is not tied to one step.</p>
      ) : (
        <div className="sv-chips">
          {field.steps.map((id) => {
            const item = CAPTURE_STEPS.find((stepItem) => stepItem.id === id);
            if (!item) return null;
            return (
              <button key={id} type="button" className={step?.id === id ? 'on' : ''} onClick={() => onStep(id)}>
                {item.short}
              </button>
            );
          })}
        </div>
      )}
      {step && field.group !== 'every' && (
        <p className="sv-note">
          {listedHere
            ? `Listed on ${step.title}.`
            : `Not listed on ${step.title}. The model still fills it, using a neutral value when it is not visible.`}
        </p>
      )}
    </section>
  );
}

function signature(field: PhotoField): string {
  if (field.kind === 'enum') return '{ type: "string", enum }';
  if (field.kind === 'integer') return '{ type: "integer" }';
  if (field.kind === 'boolean') return '{ type: "boolean" }';
  return '{ type: "string" }';
}

function TableView({
  columnId,
  onColumn,
  onJump,
}: {
  columnId: string;
  onColumn: (key: string) => void;
  onJump: (jump: SqlColumn['jump']) => void;
}) {
  const found = findColumn(columnId);
  const linked = columnId === 'homes.id' || columnId === 'photos.home_id';

  return (
    <div className="sv-table-layout" role="tabpanel">
      <div>
        <div className="sv-er">
          <TableCard table={TABLES[0]} columnId={columnId} linked={linked} onColumn={onColumn} />
          <div className="sv-rel" aria-hidden="true">
            <span>1</span>
            <i />
            <span>*</span>
            <small>home_id</small>
          </div>
          <TableCard table={TABLES[1]} columnId={columnId} linked={linked} onColumn={onColumn} />
        </div>
        <div className="sv-footnotes">
          <p>Each home has many photo rows. photos.home_id references homes.id, and the photos are deleted with the home.</p>
          <p>Photo files live in the private storage bucket named photos. storage_path is the object key.</p>
          <p>Row level security is on, with grants for the service role. The browser never queries these tables.</p>
          <ul>
            {INDEXES.map((item) => (
              <li key={item.name}>
                <code>{item.name}</code>
                <span>{item.on}</span>
              </li>
            ))}
          </ul>
          <p className="sv-source">Source: sitecheck/supabase/schema.sql. Columns are grouped for reading.</p>
        </div>
      </div>
      <aside className="sv-inspector" aria-live="polite">
        {found && <ColumnDetail column={found.column} tableName={found.table.name} onJump={onJump} />}
      </aside>
    </div>
  );
}

function TableCard({
  table,
  columnId,
  linked,
  onColumn,
}: {
  table: (typeof TABLES)[number];
  columnId: string;
  linked: boolean;
  onColumn: (key: string) => void;
}) {
  return (
    <article className={`sv-card sv-table sv-${table.name}`}>
      <div className="sv-card-head">
        <div>
          <h2>{table.name}</h2>
          <p>{table.summary}</p>
        </div>
      </div>
      {table.groups.map((group) => (
        <div key={group.label}>
          <p className="sv-group-label">{group.label}</p>
          {group.columns.map((column) => {
            const key = columnKey(table.name, column.name);
            const selected = key === columnId;
            const isLink = linked && (key === 'homes.id' || key === 'photos.home_id');
            return (
              <button
                key={key}
                type="button"
                className={`sv-col${selected ? ' is-selected' : ''}${isLink ? ' is-linked' : ''}`}
                aria-pressed={selected}
                onClick={() => onColumn(key)}
              >
                <b>{column.name}</b>
                <span>{column.sql}</span>
                {!column.required && <i>null</i>}
                {column.tags.map((tag) => (
                  <i key={tag} className={tag === 'PK' ? 'pk' : 'fk'}>
                    {tag}
                  </i>
                ))}
              </button>
            );
          })}
        </div>
      ))}
    </article>
  );
}

function ColumnDetail({
  column,
  tableName,
  onJump,
}: {
  column: SqlColumn;
  tableName: string;
  onJump: (jump: SqlColumn['jump']) => void;
}) {
  return (
    <section className="sv-block">
      <p className="sv-kicker">{tableName}</p>
      <h2>{column.name}</h2>
      <code className="sv-code">{column.ddl}</code>
      <p>{column.summary}</p>
      {column.constraint && <p className="sv-meta">Check: {column.constraint}</p>}
      {column.values && <ValueList values={column.values} label={column.valuesLabel ?? 'Allowed values'} />}
      {column.note && <p className="sv-note">{column.note}</p>}
      {column.jump && (
        <button type="button" className="sv-jump" onClick={() => onJump(column.jump)}>
          {column.jump.label}
        </button>
      )}
    </section>
  );
}

function DocumentView({ documentId, onDocument }: { documentId: string; onDocument: (id: string) => void }) {
  const doc = DOCUMENTS.find((item) => item.id === documentId) ?? DOCUMENTS[0];
  const [shownId, setShownId] = useState(doc.id);
  const [selectedPath, setSelectedPath] = useState(doc.fields[0]?.name ?? '');
  const [open, setOpen] = useState<string[]>(() => expandablePaths(doc.fields));

  if (shownId !== doc.id) {
    setShownId(doc.id);
    setSelectedPath(doc.fields[0]?.name ?? '');
    setOpen(expandablePaths(doc.fields));
  }

  const activePath = shownId === doc.id && resolveNode(doc.fields, selectedPath) ? selectedPath : (doc.fields[0]?.name ?? '');
  const openPaths = shownId === doc.id ? open : expandablePaths(doc.fields);
  const selected = resolveNode(doc.fields, activePath) ?? doc.fields[0];

  const toggle = (path: string) => {
    setOpen((current) => (current.includes(path) ? current.filter((item) => item !== path) : [...current, path]));
  };

  return (
    <div className="sv-doc" role="tabpanel">
      <nav className="sv-doc-nav" aria-label="JSON documents">
        {DOCUMENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === doc.id ? 'on' : ''}
            aria-pressed={item.id === doc.id}
            onClick={() => onDocument(item.id)}
          >
            <b>{item.title}</b>
            <small>{item.storedOn}</small>
          </button>
        ))}
      </nav>
      <section className="sv-card sv-tree-card">
        <div className="sv-card-head">
          <div>
            <h2>{doc.title}</h2>
            <p>{doc.summary}</p>
          </div>
          <code>
            {doc.storedOn} · {doc.kind}
          </code>
        </div>
        <div className="sv-tree">
          {doc.fields.map((node) => (
            <TreeNode
              key={node.name}
              node={node}
              path={node.name}
              depth={0}
              selectedPath={activePath}
              open={openPaths}
              onSelect={setSelectedPath}
              onToggle={toggle}
            />
          ))}
        </div>
        <p className="sv-source">Source: {doc.source}</p>
      </section>
      <aside className="sv-inspector" aria-live="polite">
        {selected && <NodeDetail doc={doc} node={selected} path={activePath} />}
      </aside>
    </div>
  );
}

function TreeNode({
  node,
  path,
  depth,
  selectedPath,
  open,
  onSelect,
  onToggle,
}: {
  node: SchemaNode;
  path: string;
  depth: number;
  selectedPath: string;
  open: string[];
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const expanded = open.includes(path);
  return (
    <>
      <div className={`sv-node${selectedPath === path ? ' is-selected' : ''}`} style={{ paddingLeft: 12 + depth * 16 }}>
        {hasChildren ? (
          <button type="button" className={`sv-twist${expanded ? ' open' : ''}`} aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.name}`} onClick={() => onToggle(path)}>
            <i />
          </button>
        ) : (
          <span className="sv-twist" />
        )}
        <button type="button" className="sv-node-main" aria-pressed={selectedPath === path} onClick={() => onSelect(path)}>
          <b>{node.name}</b>
          <small>{node.type}</small>
          {!node.required && <em>optional</em>}
        </button>
      </div>
      {hasChildren && expanded &&
        node.children?.map((child) => (
          <TreeNode
            key={`${path}.${child.name}`}
            node={child}
            path={`${path}.${child.name}`}
            depth={depth + 1}
            selectedPath={selectedPath}
            open={open}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

function NodeDetail({ doc, node, path }: { doc: DocumentSchema; node: SchemaNode; path: string }) {
  return (
    <section className="sv-block">
      <p className="sv-kicker">{doc.storedOn}</p>
      <h2>{path}</h2>
      <code className="sv-code">
        {node.type}
        {node.required ? '' : ' · optional'}
      </code>
      <p>{node.description}</p>
      {node.constraint && <p className="sv-meta">{node.constraint}</p>}
      {node.values && <ValueList values={node.values} label={node.valuesLabel ?? 'Allowed values'} />}
    </section>
  );
}

function ValueList({ values, label }: { values: NamedValue[]; label: string }) {
  if (values.length > 10) {
    return (
      <div className="sv-values">
        <p className="sv-kicker sv-gap">{label}</p>
        <ul className="sv-codes">
          {values.map((item) => (
            <li key={item.value}>
              <code>{item.value}</code>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="sv-values">
      <p className="sv-kicker sv-gap">{label}</p>
      <div className="sv-chips">
        {values.map((item) => (
          <span key={item.value}>
            <b>{item.label}</b>
            {item.label.replace(/\s/g, '_').toLowerCase() !== item.value && <code>{item.value}</code>}
          </span>
        ))}
      </div>
    </div>
  );
}

function expandablePaths(nodes: SchemaNode[], prefix = ''): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    const path = prefix ? `${prefix}.${node.name}` : node.name;
    if (node.children?.length) out.push(path, ...expandablePaths(node.children, path));
  }
  return out;
}

function resolveNode(nodes: SchemaNode[], path: string): SchemaNode | null {
  const [head, ...rest] = path.split('.');
  const node = nodes.find((item) => item.name === head);
  if (!node) return null;
  if (rest.length === 0) return node;
  return resolveNode(node.children ?? [], rest.join('.'));
}
