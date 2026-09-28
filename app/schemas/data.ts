/**
 * Display data for the schema visualizers.
 * Source of truth:
 * - sitecheck/src/lib/schema.ts
 * - sitecheck/src/lib/steps.ts
 * - sitecheck/src/lib/siteCheck.ts
 * - sitecheck/src/lib/property.ts
 * - sitecheck/src/lib/types.ts
 * - sitecheck/src/lib/plan.ts
 * - sitecheck/src/lib/rules.ts
 * - sitecheck/supabase/schema.sql
 */

export type ViewId = 'fields' | 'tables' | 'documents';

export type NamedValue = { value: string; label: string };

export type PhotoField = {
  name: string;
  order: number;
  kind: 'boolean' | 'integer' | 'string' | 'enum';
  group: 'every' | 'setup' | 'reading' | 'framing' | 'clearance';
  definition: string;
  values?: NamedValue[];
  /** What the model should write when the thing is not visible. */
  neutral?: string;
  parse?: string;
  note?: string;
  /** Capture steps that list this field. Empty means every photo. */
  steps: string[];
};

export type CaptureStep = {
  id: string;
  title: string;
  short: string;
  slot: string;
  instruction: string;
  note?: string;
};

export type SqlColumn = {
  name: string;
  sql: string;
  ddl: string;
  required: boolean;
  tags: Array<'PK' | 'FK'>;
  summary: string;
  values?: NamedValue[];
  valuesLabel?: string;
  constraint?: string;
  note?: string;
  jump?: { view: 'fields' | 'documents'; documentId?: string; label: string };
};

export type SqlGroup = { label: string; columns: SqlColumn[] };

export type SqlTable = {
  name: 'homes' | 'photos';
  summary: string;
  groups: SqlGroup[];
};

export type SchemaNode = {
  name: string;
  type: string;
  required: boolean;
  description: string;
  values?: NamedValue[];
  valuesLabel?: string;
  constraint?: string;
  children?: SchemaNode[];
};

export type DocumentSchema = {
  id: string;
  title: string;
  storedOn: string;
  kind: 'object' | 'array';
  summary: string;
  source: string;
  fields: SchemaNode[];
};

export const CAPTURE_STEPS: CaptureStep[] = [
  {
    id: 'meter_area_wide',
    title: 'Meter and wall',
    short: 'Wall',
    slot: 'electric_meter_surroundings',
    instruction: 'About 10 steps back, with the whole wall and the ground in frame.',
  },
  {
    id: 'meter_closeup',
    title: 'Meter close-up',
    short: 'Close-up',
    slot: 'electric_meter_close_up',
    instruction: 'Close enough to read the meter numbers, with the whole meter box in frame.',
  },
  {
    id: 'left_of_meter',
    title: 'Left of the meter',
    short: 'Left',
    slot: 'electric_meter_left',
    instruction: 'The wall and ground to the left, with the meter at the right edge.',
  },
  {
    id: 'right_of_meter',
    title: 'Right of the meter',
    short: 'Right',
    slot: 'electric_meter_right',
    instruction: 'The wall and ground to the right, with the meter at the left edge.',
  },
  {
    id: 'adjacent_wall',
    title: 'Around the corner',
    short: 'Corner',
    slot: 'electric_meter_around_corner',
    instruction: 'The nearest neighbouring wall, from corner to corner.',
  },
  {
    id: 'behind_fence',
    title: 'Behind the fence',
    short: 'Fence',
    slot: 'electric_meter_behind_fence',
    instruction: 'The full area behind a fence next to the meter wall.',
    note: 'Asked only after an accepted wide, left, or right photo has fence_present.',
  },
  {
    id: 'panel_wide',
    title: 'Breaker box and surroundings',
    short: 'Box wide',
    slot: 'main_breaker_box_wall',
    instruction: 'The main breaker box zoomed out enough to see where it sits.',
    note: 'Skipped when the stored setup is a combo meter and main unit.',
  },
  {
    id: 'panel_open',
    title: 'Breaker box open',
    short: 'Box open',
    slot: 'main_breaker_box_open',
    instruction: 'The hinged door open, with the breakers and the door label in frame.',
    note: 'Skipped when the stored setup is a combo meter and main unit.',
  },
  {
    id: 'main_disconnect_closeup',
    title: 'Main switch',
    short: 'Switch',
    slot: 'main_disconnect_switch_photo',
    instruction: 'A close-up of the main disconnect with the amp number readable.',
  },
];

const RETAKE: NamedValue[] = [
  { value: 'none', label: 'None' },
  { value: 'too_dark', label: 'Too dark' },
  { value: 'blurry', label: 'Blurry' },
  { value: 'too_close', label: 'Too close' },
  { value: 'too_far', label: 'Too far' },
  { value: 'wrong_subject', label: 'Wrong subject' },
  { value: 'lid_closed', label: 'Lid closed' },
  { value: 'view_blocked', label: 'View blocked' },
  { value: 'text_unreadable', label: 'Text unreadable' },
];

const AI_SETUP: NamedValue[] = [
  { value: 'separate_meter_and_panel_outdoors', label: 'Meter and separate breaker box, both outdoors' },
  { value: 'combo_meter_main_unit', label: 'All-in-one meter and main breaker' },
  { value: 'panel_not_visible', label: 'Breaker box not in the photo' },
  { value: 'unknown', label: 'Unknown' },
];

const LOCATIONS: NamedValue[] = [
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'garage', label: 'Garage' },
  { value: 'closet', label: 'Closet' },
  { value: 'indoor_other', label: 'Other indoor' },
  { value: 'unknown', label: 'Unknown' },
];

const GROUND: NamedValue[] = [
  { value: 'none', label: 'None' },
  { value: 'room_for_one', label: 'Room for one' },
  { value: 'room_for_two', label: 'Room for two' },
  { value: 'unclear', label: 'Unclear' },
];

const BRANDS: NamedValue[] = [
  { value: 'federal_pacific', label: 'Federal Pacific' },
  { value: 'zinsco', label: 'Zinsco' },
  { value: 'challenger', label: 'Challenger' },
  { value: 'sylvania', label: 'Sylvania' },
  { value: 'westinghouse', label: 'Westinghouse' },
  { value: 'other', label: 'Other readable brand' },
  { value: 'not_visible', label: 'Not visible' },
];

export const PHOTO_FIELDS: PhotoField[] = [
  {
    name: 'photo_matches_request',
    order: 1,
    kind: 'boolean',
    group: 'every',
    definition: 'The photo shows what this step asked for.',
    steps: [],
  },
  {
    name: 'usable',
    order: 2,
    kind: 'boolean',
    group: 'every',
    definition: 'A reviewer could answer this step from this photo alone, without asking for another.',
    steps: [],
  },
  {
    name: 'retake_reason',
    order: 3,
    kind: 'enum',
    group: 'every',
    definition: 'The single most important reason to retake, or none.',
    values: RETAKE,
    neutral: 'none',
    steps: [],
  },
  {
    name: 'retake_instruction',
    order: 4,
    kind: 'string',
    group: 'every',
    definition: 'One short sentence telling the homeowner what to do. Max 15 words.',
    neutral: '""',
    steps: [],
  },
  {
    name: 'confidence',
    order: 5,
    kind: 'integer',
    group: 'every',
    definition: 'How sure the model is about the fields that matter for this step, from 0 to 100.',
    parse: 'Rounded and clamped to 0–100.',
    note: 'The rules engine treats a reading below 80 as unsure, and turns a fail from that photo into a review.',
    steps: [],
  },
  {
    name: 'setup_type',
    order: 6,
    kind: 'enum',
    group: 'setup',
    definition: 'How the meter and breaker box are arranged in this photo.',
    values: AI_SETUP,
    neutral: 'unknown',
    note: 'On the home row, panel_not_visible is stored as panel_indoors. The wide meter photo is trusted when it was accepted. Otherwise the other accepted photos vote.',
    steps: ['meter_area_wide'],
  },
  {
    name: 'amp_rating',
    order: 7,
    kind: 'integer',
    group: 'reading',
    definition: 'The amp number printed on the main disconnect. Typical values are 100, 125, 150, 175, and 200.',
    neutral: '0',
    parse: 'Rounded to an integer. 0 means the number was not read.',
    steps: ['main_disconnect_closeup'],
  },
  {
    name: 'amp_rating_legible',
    order: 8,
    kind: 'boolean',
    group: 'reading',
    definition: 'True only when that amp number can be read with certainty.',
    neutral: 'false',
    steps: ['main_disconnect_closeup'],
  },
  {
    name: 'meter_number_legible',
    order: 9,
    kind: 'boolean',
    group: 'reading',
    definition: 'The numbers on the electric meter are readable.',
    neutral: 'false',
    steps: ['meter_closeup'],
  },
  {
    name: 'location',
    order: 10,
    kind: 'enum',
    group: 'setup',
    definition: 'Where the breaker box is.',
    values: LOCATIONS,
    neutral: 'unknown',
    note: 'Closet and other indoor living space fail the preliminary check, unless confidence is below 80, which sends it to review. Outdoors and a garage are fine.',
    steps: ['panel_wide'],
  },
  {
    name: 'damage_visible',
    order: 11,
    kind: 'boolean',
    group: 'clearance',
    definition: 'Broken, cracked, bent, loose, missing covers, exposed wires, or burn marks. An opened door does not count. Rust alone does not count.',
    neutral: 'false',
    steps: ['meter_closeup', 'panel_wide', 'panel_open', 'main_disconnect_closeup'],
  },
  {
    name: 'gas_meter_near',
    order: 12,
    kind: 'boolean',
    group: 'clearance',
    definition: 'A gas meter is within a few feet of the electric meter or the clear ground.',
    neutral: 'false',
    steps: ['meter_area_wide', 'left_of_meter', 'right_of_meter', 'adjacent_wall', 'behind_fence'],
  },
  {
    name: 'window_near',
    order: 13,
    kind: 'boolean',
    group: 'clearance',
    definition: 'A window is within a few feet of the electric meter or the clear ground.',
    neutral: 'false',
    steps: ['meter_area_wide', 'left_of_meter', 'right_of_meter', 'adjacent_wall', 'behind_fence'],
  },
  {
    name: 'ac_unit_near',
    order: 14,
    kind: 'boolean',
    group: 'clearance',
    definition: 'An air conditioner is within a few feet of the electric meter or the clear ground.',
    neutral: 'false',
    steps: ['meter_area_wide', 'left_of_meter', 'right_of_meter', 'adjacent_wall', 'behind_fence'],
  },
  {
    name: 'fence_present',
    order: 15,
    kind: 'boolean',
    group: 'clearance',
    definition: 'A fence is visible. An accepted true on the wide, left, or right photo adds the behind-the-fence step.',
    neutral: 'false',
    steps: ['meter_area_wide', 'left_of_meter', 'right_of_meter'],
  },
  {
    name: 'clutter_blocking',
    order: 16,
    kind: 'boolean',
    group: 'clearance',
    definition: 'Loose objects block the meter, the wall, or the ground. That is a finding, not a reason to retake.',
    neutral: 'false',
    steps: ['meter_area_wide', 'left_of_meter', 'right_of_meter', 'adjacent_wall', 'behind_fence'],
  },
  {
    name: 'clear_ground_space',
    order: 17,
    kind: 'enum',
    group: 'clearance',
    definition: 'Clear ground against the wall. Room for one is about 3 by 3 feet. Room for two is about 6 feet wide.',
    values: GROUND,
    neutral: 'unclear',
    note: 'Space rules use the best clear patch across the wall photos and any extra steps. None, when every judged photo agrees, is a fail.',
    steps: ['meter_area_wide', 'left_of_meter', 'right_of_meter', 'adjacent_wall', 'behind_fence'],
  },
  {
    name: 'multiple_panels_visible',
    order: 18,
    kind: 'boolean',
    group: 'setup',
    definition: 'More than one breaker box is visible.',
    neutral: 'false',
    steps: ['meter_area_wide', 'panel_wide', 'panel_open'],
  },
  {
    name: 'meter_count',
    order: 19,
    kind: 'integer',
    group: 'setup',
    definition: 'How many electric meters are visible.',
    neutral: '0',
    parse: 'Rounded, and never below 0. 0 means none are visible.',
    steps: ['meter_area_wide', 'meter_closeup'],
  },
  {
    name: 'meter_can_edges_visible',
    order: 20,
    kind: 'boolean',
    group: 'framing',
    definition: 'The top and bottom edges of the meter box are both in the photo, with some wall beyond each edge.',
    neutral: 'false',
    steps: ['meter_closeup'],
  },
  {
    name: 'ground_visible',
    order: 21,
    kind: 'boolean',
    group: 'framing',
    definition: 'The ground along the bottom of the wall is visible.',
    neutral: 'false',
    steps: ['meter_area_wide', 'left_of_meter', 'right_of_meter', 'adjacent_wall', 'behind_fence'],
  },
  {
    name: 'enough_wall_shown',
    order: 22,
    kind: 'boolean',
    group: 'framing',
    definition: 'About 6 feet of wall and ground on the side this photo is about, or up to where the wall ends. Plants and clutter do not make this false.',
    neutral: 'false',
    steps: ['left_of_meter', 'right_of_meter', 'adjacent_wall', 'behind_fence'],
  },
  {
    name: 'panel_context_visible',
    order: 23,
    kind: 'boolean',
    group: 'framing',
    definition: 'The surroundings show whether the breaker box is outdoors, in a garage, or inside the living space.',
    neutral: 'false',
    steps: ['panel_wide'],
  },
  {
    name: 'panel_brand',
    order: 24,
    kind: 'enum',
    group: 'reading',
    definition: 'The manufacturer printed on the label or the breakers. Never guessed from how the box looks.',
    values: BRANDS,
    neutral: 'not_visible',
    note: 'Federal Pacific includes FPE and Stab-Lok. Zinsco includes GTE-Sylvania and Magnetrip. Those four, plus Challenger and Sylvania, are recalled brands. Westinghouse is a manual check.',
    steps: ['panel_open'],
  },
  {
    name: 'panel_label_legible',
    order: 25,
    kind: 'boolean',
    group: 'reading',
    definition: 'The brand or label text can be read with certainty.',
    neutral: 'false',
    steps: ['panel_open'],
  },
  {
    name: 'heavy_rust',
    order: 26,
    kind: 'boolean',
    group: 'clearance',
    definition: 'Heavy or widespread rust on the box or breakers. A few small spots do not count.',
    neutral: 'false',
    note: 'Only the open-box step lists it. The rules also count a true value on the wide box photo and the main switch.',
    steps: ['panel_open'],
  },
  {
    name: 'notes',
    order: 27,
    kind: 'string',
    group: 'every',
    definition: 'Anything else visible that the fields do not cover.',
    neutral: '""',
    steps: [],
  },
];

export const FIELD_GROUPS: { id: PhotoField['group']; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'reading', label: 'Readings' },
  { id: 'framing', label: 'Framing' },
  { id: 'clearance', label: 'Space and condition' },
];

export const GROUP_LABEL: Record<PhotoField['group'], string> = {
  every: 'Every photo',
  setup: 'Setup',
  reading: 'Readings',
  framing: 'Framing',
  clearance: 'Space and condition',
};

const STORED_SETUP: NamedValue[] = [
  { value: 'separate_meter_and_panel_outdoors', label: 'Meter and separate breaker box, both outdoors' },
  { value: 'combo_meter_main_unit', label: 'All-in-one meter and main breaker' },
  { value: 'panel_indoors', label: 'Breaker box indoors' },
  { value: 'unknown', label: 'Unknown' },
];

export const TABLES: SqlTable[] = [
  {
    name: 'homes',
    summary: 'One row per homeowner submission.',
    groups: [
      {
        label: 'Identity',
        columns: [
          {
            name: 'id',
            sql: 'uuid',
            ddl: 'uuid primary key default gen_random_uuid()',
            required: true,
            tags: ['PK'],
            summary: 'Primary key. Photo rows point here.',
          },
          {
            name: 'created_at',
            sql: 'timestamptz',
            ddl: 'timestamptz not null default now()',
            required: true,
            tags: [],
            summary: 'When the row was created. Indexed descending for the surveyor queue.',
          },
          {
            name: 'external_ref',
            sql: 'text',
            ddl: 'text',
            required: false,
            tags: [],
            summary: 'Order id from the system that sent the customer here.',
          },
          {
            name: 'address',
            sql: 'text',
            ddl: 'text',
            required: false,
            tags: [],
            summary: 'Street address. The only homeowner question this app owns. Other details can arrive later.',
          },
          {
            name: 'customer_name',
            sql: 'text',
            ddl: 'text',
            required: false,
            tags: [],
            summary: 'Filled by the signup system. Null means it has not been sent.',
          },
          {
            name: 'customer_email',
            sql: 'text',
            ddl: 'text',
            required: false,
            tags: [],
            summary: 'Filled by the signup system. Null means it has not been sent.',
          },
        ],
      },
      {
        label: 'Answers',
        columns: [
          {
            name: 'in_austin',
            sql: 'boolean',
            ddl: 'boolean',
            required: false,
            tags: [],
            summary: 'Null means not known yet. Amp rules that depend on it go to review instead of guessing.',
            note: 'Austin homes need 150A. Elsewhere the minimum is 100A.',
          },
          {
            name: 'has_solar',
            sql: 'boolean',
            ddl: 'boolean',
            required: false,
            tags: [],
            summary: 'Null means not known yet. Between 150A and 200A the battery count depends on solar, so an unknown answer goes to review.',
          },
          {
            name: 'panel_same_wall_answer',
            sql: 'text',
            ddl: "text not null default 'not_asked'",
            required: true,
            tags: [],
            summary: 'Whether an indoor breaker box is on the same wall as the meter.',
            values: [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
              { value: 'not_sure', label: 'Not sure' },
              { value: 'not_asked', label: 'Not asked' },
            ],
            note: 'Asked before the breaker-box photos when the stored setup is panel_indoors.',
          },
        ],
      },
      {
        label: 'Check',
        columns: [
          {
            name: 'setup_type',
            sql: 'text',
            ddl: "text not null default 'unknown'",
            required: true,
            tags: [],
            summary: 'The setup used to decide which photos to ask for.',
            values: STORED_SETUP,
            note: 'This is not the photo enum. panel_not_visible on a photo is written here as panel_indoors. A combo unit skips the separate breaker-box photos.',
            jump: { view: 'fields', label: 'Open setup_type on the photo schema' },
          },
          {
            name: 'status',
            sql: 'text',
            ddl: "text not null default 'in_progress'",
            required: true,
            tags: [],
            summary: 'Whether the homeowner has submitted.',
            values: [
              { value: 'in_progress', label: 'In progress' },
              { value: 'submitted', label: 'Submitted' },
            ],
          },
          {
            name: 'verdict',
            sql: 'text',
            ddl: 'text',
            required: false,
            tags: [],
            summary: 'Preliminary check from the rules engine. Null until the rules run. The surveyor decision is separate.',
            values: [
              { value: 'PASS', label: 'Pass' },
              { value: 'FAIL', label: 'Fail' },
              { value: 'REVIEW', label: 'Review' },
            ],
          },
          {
            name: 'battery_count',
            sql: 'int',
            ddl: 'int check (battery_count between 0 and 2)',
            required: false,
            tags: [],
            summary: '0, 1, or 2. Null until the rules run. A fail stores 0.',
            constraint: '0 to 2',
          },
          {
            name: 'reasons',
            sql: 'jsonb',
            ddl: "jsonb not null default '[]'",
            required: true,
            tags: [],
            summary: 'One object per rule that fired, worst outcome first.',
            jump: { view: 'documents', documentId: 'reasons', label: 'Open the reason document' },
          },
          {
            name: 'site_check_status',
            sql: 'text',
            ddl: "text not null default 'not_run'",
            required: true,
            tags: [],
            summary: 'Whether the whole-site check has run. A failed check still lets the homeowner finish, and the rules add a review reason.',
            values: [
              { value: 'not_run', label: 'Not run' },
              { value: 'done', label: 'Done' },
              { value: 'failed', label: 'Failed' },
            ],
          },
          {
            name: 'site_check',
            sql: 'jsonb',
            ddl: 'jsonb',
            required: false,
            tags: [],
            summary: 'What the whole-site check decided about photo coverage. Null until it runs.',
            jump: { view: 'documents', documentId: 'site_check', label: 'Open the site check document' },
          },
          {
            name: 'extra_steps',
            sql: 'jsonb',
            ddl: "jsonb not null default '[]'",
            required: true,
            tags: [],
            summary: 'Up to two extra photo requests when coverage is incomplete.',
            jump: { view: 'documents', documentId: 'extra_steps', label: 'Open the extra step document' },
          },
          {
            name: 'property',
            sql: 'jsonb',
            ddl: 'jsonb',
            required: false,
            tags: [],
            summary: 'Map answers for the home, the front entrance, and the meter. Null before the map step.',
            jump: { view: 'documents', documentId: 'property', label: 'Open the property document' },
          },
        ],
      },
      {
        label: 'Review',
        columns: [
          {
            name: 'surveyor_decision',
            sql: 'text',
            ddl: 'text',
            required: false,
            tags: [],
            summary: 'The person who reviews the home. This is the decision that counts. The verdict is only a preliminary check.',
            values: [
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'needs_site_visit', label: 'Needs site visit' },
            ],
          },
          {
            name: 'surveyor_note',
            sql: 'text',
            ddl: 'text',
            required: false,
            tags: [],
            summary: 'Free-text note saved with the surveyor decision.',
          },
          {
            name: 'submitted_at',
            sql: 'timestamptz',
            ddl: 'timestamptz',
            required: false,
            tags: [],
            summary: 'When the homeowner submitted. Null while the check is in progress.',
          },
          {
            name: 'decided_at',
            sql: 'timestamptz',
            ddl: 'timestamptz',
            required: false,
            tags: [],
            summary: 'When the surveyor decision was last saved. Null for decisions made before this column existed.',
          },
        ],
      },
    ],
  },
  {
    name: 'photos',
    summary: 'One row per capture attempt, including retakes.',
    groups: [
      {
        label: 'Identity',
        columns: [
          {
            name: 'id',
            sql: 'uuid',
            ddl: 'uuid primary key default gen_random_uuid()',
            required: true,
            tags: ['PK'],
            summary: 'Primary key for this attempt.',
          },
          {
            name: 'created_at',
            sql: 'timestamptz',
            ddl: 'timestamptz not null default now()',
            required: true,
            tags: [],
            summary: 'When this attempt was stored.',
          },
          {
            name: 'home_id',
            sql: 'uuid',
            ddl: 'uuid not null references public.homes(id) on delete cascade',
            required: true,
            tags: ['FK'],
            summary: 'The home this attempt belongs to. Deleting the home deletes its photos.',
          },
        ],
      },
      {
        label: 'Capture',
        columns: [
          {
            name: 'step',
            sql: 'text',
            ddl: 'text not null',
            required: true,
            tags: [],
            summary: 'Which shot this is. A regular step id, or extra_1 / extra_2.',
            jump: { view: 'fields', label: 'Open the capture steps' },
          },
          {
            name: 'attempt',
            sql: 'int',
            ddl: 'int not null',
            required: true,
            tags: [],
            summary: 'Starts at 1. A retake inserts another row for the same step.',
          },
          {
            name: 'storage_path',
            sql: 'text',
            ddl: 'text not null',
            required: true,
            tags: [],
            summary: 'Object key in the private photos bucket. The file itself is not in this table.',
          },
          {
            name: 'status',
            sql: 'text',
            ddl: 'text not null',
            required: true,
            tags: [],
            summary: 'What happened to this attempt. The latest non-retake row is the one the rules read.',
            values: [
              { value: 'accepted', label: 'Accepted' },
              { value: 'retake', label: 'Retake requested' },
              { value: 'check_failed', label: 'Automatic check failed' },
              { value: 'accepted_after_max_attempts', label: 'Kept for review' },
            ],
          },
        ],
      },
      {
        label: 'Reading',
        columns: [
          {
            name: 'analysis',
            sql: 'jsonb',
            ddl: 'jsonb',
            required: false,
            tags: [],
            summary: 'The 27-field photo reading. Null when the model call failed.',
            jump: { view: 'fields', label: 'Open the photo field matrix' },
          },
          {
            name: 'error',
            sql: 'text',
            ddl: 'text',
            required: false,
            tags: [],
            summary: 'Why the model call failed, when status is check_failed.',
          },
          {
            name: 'model',
            sql: 'text',
            ddl: 'text',
            required: false,
            tags: [],
            summary: 'Model id used for this attempt.',
          },
          {
            name: 'latency_ms',
            sql: 'int',
            ddl: 'int',
            required: false,
            tags: [],
            summary: 'How long the model call took, in milliseconds.',
          },
          {
            name: 'ai_attempts',
            sql: 'int',
            ddl: 'int not null default 1',
            required: true,
            tags: [],
            summary: 'How many model calls this row used. The app retries up to 3 times.',
          },
        ],
      },
    ],
  },
];

export const INDEXES = [
  { name: 'photos_home_idx', on: 'photos (home_id, step, attempt)' },
  { name: 'homes_created_idx', on: 'homes (created_at desc)' },
];

const coordinate = (name: string, description: string): SchemaNode => ({
  name,
  type: 'object',
  required: false,
  description,
  children: [
    { name: 'lat', type: 'number', required: true, description: 'Latitude.', constraint: '-90 to 90' },
    { name: 'lng', type: 'number', required: true, description: 'Longitude.', constraint: '-180 to 180' },
  ],
});

const mapPoint = (name: string, description: string): SchemaNode => ({
  name,
  type: 'object',
  required: false,
  description,
  children: [
    { name: 'x', type: 'number', required: true, description: 'Across the example map.', constraint: '0 to 1' },
    { name: 'y', type: 'number', required: true, description: 'Down the example map.', constraint: '0 to 1' },
  ],
});

const REASON_CODES: NamedValue[] = [
  { value: 'STEP_MISSING', label: 'REVIEW · a required photo is missing' },
  { value: 'STEP_UNCLEAR', label: 'REVIEW · a retake was kept for a person' },
  { value: 'CHECK_FAILED', label: 'REVIEW · the model call failed' },
  { value: 'SITE_CHECK_FAILED', label: 'REVIEW · the whole-site check could not run' },
  { value: 'AMP_UNREADABLE', label: 'REVIEW · the amp number could not be read' },
  { value: 'AMP_TOO_LOW', label: 'FAIL, or REVIEW if confidence is below 80 · service below the local minimum' },
  { value: 'AMP_LOCATION_UNKNOWN', label: 'REVIEW · 100–149A and Austin is unknown' },
  { value: 'SOLAR_UNKNOWN', label: 'REVIEW · 150–199A and solar is unknown' },
  { value: 'AMP_ABOVE_200', label: 'REVIEW · above the published 100–200A range' },
  { value: 'AMP_OK', label: 'PASS · the main breaker supports 1 or 2 batteries' },
  { value: 'SOLAR_LIMITS_TO_ONE', label: 'PASS · solar and under 200A, so 1 battery' },
  { value: 'SETUP_UNCLEAR', label: 'REVIEW · the meter and breaker setup could not be told' },
  { value: 'PANEL_IN_LIVING_SPACE', label: 'FAIL, or REVIEW if confidence is below 80 · closet or other living space' },
  { value: 'PANEL_NOT_SAME_WALL', label: 'REVIEW · indoor box is not on the meter wall' },
  { value: 'PANEL_WALL_UNSURE', label: 'REVIEW · the homeowner is unsure, or has not been asked' },
  { value: 'MULTIPLE_METERS', label: 'REVIEW · more than one meter' },
  { value: 'MULTIPLE_PANELS', label: 'REVIEW · more than one breaker box' },
  { value: 'DAMAGE', label: 'REVIEW · visible damage, repair before install' },
  { value: 'PANEL_RECALLED_BRAND', label: 'REVIEW · Federal Pacific, Zinsco, Challenger, or Sylvania' },
  { value: 'PANEL_BRAND_CHECK', label: 'REVIEW · Westinghouse' },
  { value: 'PANEL_BRAND_UNREADABLE', label: 'REVIEW · brand or label could not be read' },
  { value: 'HEAVY_RUST', label: 'REVIEW · heavy rust, repair before install' },
  { value: 'OBSTACLE_NEAR_METER', label: 'REVIEW · gas meter, window, or air conditioner near the meter' },
  { value: 'NO_SPACE', label: 'FAIL, or REVIEW if confidence is below 80 · no clear ground' },
  { value: 'SPACE_UNCLEAR', label: 'REVIEW · ground space could not be judged' },
  { value: 'SPACE_OK', label: 'PASS · ground fits 1 or 2 batteries' },
  { value: 'CAPPED_BY_SPACE', label: 'PASS · the panel supports 2, the ground fits 1' },
];

export const DOCUMENTS: DocumentSchema[] = [
  {
    id: 'site_check',
    title: 'Site check',
    storedOn: 'homes.site_check',
    kind: 'object',
    summary: 'One look at the wall photos together. It decides whether coverage is enough, and it does not decide whether a battery fits.',
    source: 'sitecheck/src/lib/siteCheck.ts',
    fields: [
      {
        name: 'covered',
        type: 'boolean',
        required: true,
        description: 'True when the photos already show one open spot against a wall near the meter, with the ground in front of it.',
      },
      {
        name: 'missing_views',
        type: 'object[]',
        required: true,
        description: 'Areas that are not shown and might hold the battery. Empty when covered is true. The prompt asks for at most 2, and the app keeps at most 2.',
        children: [
          {
            name: 'instruction',
            type: 'string',
            required: true,
            description: 'One short sentence for the homeowner. Max 15 words. No jargon.',
          },
          {
            name: 'reason',
            type: 'string',
            required: true,
            description: 'Why this view is missing.',
          },
        ],
      },
      {
        name: 'summary',
        type: 'string',
        required: true,
        description: 'One plain sentence describing what the photos cover.',
      },
      {
        name: 'confidence',
        type: 'integer',
        required: true,
        description: 'How sure the coverage decision is.',
        constraint: '0 to 100, clamped after parsing',
      },
    ],
  },
  {
    id: 'property',
    title: 'Property',
    storedOn: 'homes.property',
    kind: 'object',
    summary: 'Where the home, the front entrance, and the meter are. From Google Maps, or from the example map on the demo form.',
    source: 'sitecheck/src/lib/property.ts',
    fields: [
      { name: 'address', type: 'string', required: true, description: 'Address the customer confirmed.', constraint: 'Trimmed, at most 300 characters' },
      {
        name: 'source',
        type: 'enum',
        required: true,
        description: 'Which map the points came from.',
        values: [
          { value: 'google', label: 'Google' },
          { value: 'example', label: 'Example map' },
        ],
      },
      { name: 'placeId', type: 'string', required: false, description: 'Google place id, when the source is Google.', constraint: '1 to 300 characters' },
      coordinate('house', 'The home, when a real map was used.'),
      coordinate('front', 'The front entrance, when a real map was used.'),
      coordinate('meter', 'The electric meter, when a real map was used.'),
      mapPoint('exampleFront', 'Front entrance on the example map, as a fraction of the image.'),
      mapPoint('exampleMeter', 'Meter on the example map, as a fraction of the image.'),
      { name: 'frontUncertain', type: 'boolean', required: true, description: 'The customer was not sure about the front entrance.' },
      { name: 'meterUncertain', type: 'boolean', required: true, description: 'The customer was not sure about the meter.' },
      { name: 'propertyConfirmed', type: 'boolean', required: true, description: 'The customer confirmed this is the right property.' },
      { name: 'mapDone', type: 'boolean', required: false, description: 'True once the customer finished the map step.' },
    ],
  },
  {
    id: 'reasons',
    title: 'Reason',
    storedOn: 'homes.reasons',
    kind: 'array',
    summary: 'The rules engine appends one of these for every check that fires. Any fail makes the verdict FAIL. Otherwise any review makes it REVIEW.',
    source: 'sitecheck/src/lib/types.ts and sitecheck/src/lib/rules.ts',
    fields: [
      {
        name: 'code',
        type: 'string',
        required: true,
        description: 'Which rule fired. Not a database enum. The list is the set the rules engine writes today.',
        values: REASON_CODES,
        valuesLabel: 'Codes the rules engine writes',
      },
      {
        name: 'outcome',
        type: 'enum',
        required: true,
        description: 'What this one reason contributes. A fail from a photo read below 80 confidence is stored as REVIEW.',
        values: [
          { value: 'FAIL', label: 'Fail' },
          { value: 'REVIEW', label: 'Review' },
          { value: 'PASS', label: 'Pass' },
        ],
      },
      { name: 'message', type: 'string', required: true, description: 'The sentence shown to the surveyor.' },
      {
        name: 'step',
        type: 'string | null',
        required: true,
        description: 'The photo step that produced the reason. Null when the reason is about the whole home.',
        constraint: 'A step id, extra_<n>, or null',
      },
    ],
  },
  {
    id: 'extra_steps',
    title: 'Extra step',
    storedOn: 'homes.extra_steps',
    kind: 'array',
    summary: 'Built from missing_views when the site check says coverage is incomplete. Each one becomes another photo the homeowner is asked for.',
    source: 'sitecheck/src/lib/siteCheck.ts',
    fields: [
      { name: 'id', type: 'string', required: true, description: 'extra_1 or extra_2.', constraint: 'At most two items' },
      { name: 'instruction', type: 'string', required: true, description: 'The sentence shown on the camera step. Copied from the missing view.' },
      { name: 'reason', type: 'string', required: true, description: 'Why this photo was asked for. Shown to the surveyor, not the homeowner.' },
    ],
  },
];

export function columnKey(table: string, name: string): string {
  return `${table}.${name}`;
}

export function findColumn(key: string): { table: SqlTable; column: SqlColumn } | null {
  for (const table of TABLES) {
    for (const group of table.groups) {
      const column = group.columns.find((item) => columnKey(table.name, item.name) === key);
      if (column) return { table, column };
    }
  }
  return null;
}
