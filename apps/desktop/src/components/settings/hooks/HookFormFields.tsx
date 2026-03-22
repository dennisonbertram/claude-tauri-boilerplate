import type { HookEventMeta } from '@claude-tauri/shared';
import type { AddHookForm, HandlerType } from './types';
import { HandlerFields } from './HandlerFields';

export function HookFormFields({
  form,
  setForm,
  events,
  eventMetaMap,
  isEdit,
}: {
  form: AddHookForm;
  setForm: (f: AddHookForm) => void;
  events: HookEventMeta[];
  eventMetaMap: Record<string, HookEventMeta>;
  isEdit?: boolean;
}) {
  const selectedEvent = eventMetaMap[form.event];
  const showMatcher = selectedEvent?.supportsMatcher ?? false;

  return (
    <>
      {/* Event Type */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Event Type</label>
        <select
          data-testid={isEdit ? 'hooks-edit-event-select' : 'hooks-add-event-select'}
          value={form.event}
          onChange={(e) => setForm({ ...form, event: e.target.value })}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {events.map((evt) => (
            <option key={evt.event} value={evt.event}>
              {evt.event} - {evt.description}
            </option>
          ))}
        </select>
      </div>

      {/* Matcher (conditional) */}
      {showMatcher && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Matcher (regex pattern, e.g. tool name)
          </label>
          <input
            data-testid={isEdit ? 'hooks-edit-matcher-input' : 'hooks-add-matcher-input'}
            type="text"
            placeholder="Bash"
            value={form.matcher}
            onChange={(e) => setForm({ ...form, matcher: e.target.value })}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      )}

      {/* Handler Type */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Handler Type</label>
        <select
          data-testid={isEdit ? 'hooks-edit-handler-type-select' : 'hooks-add-handler-type-select'}
          value={form.handlerType}
          onChange={(e) => setForm({ ...form, handlerType: e.target.value as HandlerType })}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="command">Command</option>
          <option value="http">HTTP</option>
          <option value="prompt">Prompt</option>
        </select>
      </div>

      {/* Handler-specific fields */}
      <HandlerFields form={form} setForm={setForm} isEdit={isEdit} />
    </>
  );
}
