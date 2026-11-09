# Incident Management System

Complete incident management system for MonsoonMesh web app enabling create, update, and close workflows from the UI.

## Features Implemented

### 1. Create Incident Modal/Form
- **New Report Button**: "New report" button on IncidentsPage header
- **Modal Form**: Reusable Modal component with incident creation form
- **Fields**:
  - `title` (required, 4-160 chars): Incident title
  - `description` (required, 8-5000 chars): Detailed description
  - `category` (required): Dropdown with WATERLOGGING, FLOODING, DRAINAGE, ROAD_BLOCKAGE, OTHER
  - `severity` (required): Dropdown with LOW, MODERATE, HIGH, CRITICAL
  - `latitude`/`longitude` (required): Map location as numeric coordinates
- **Validation**: All fields validated on form level; server-side validation via Zod schema
- **Submit**: Calls `POST /api/incidents` via `createIncident()`
- **Success Workflow**:
  - Modal closes automatically
  - Toast notification shows incident ID
  - Incident list refreshes
  - Dashboard queries invalidated
- **Error Handling**: Errors displayed in toast with clear messaging

### 2. Incident Detail Panel/Modal
- **Access**: Click any incident row to open detail view
- **Layout**: Responsive modal (600px width) with full incident information
- **Sections**:
  - **Header**: ID, category, severity badge, status badge, coordinates, reported date, zone
  - **Description**: Full incident description in formatted panel
  - **Status Update**: Action buttons for available status transitions (ADMIN/OPERATOR only)
  - **Event History**: Timeline component showing all status changes with timestamps
  - **Evidence**: List of uploaded files with download buttons
  - **Related Incidents**: Duplicate detection results with similarity scores and matching reasons

### 3. Update Incident Status Workflow
- **Status Transitions**: Defined state machine with valid transitions:
  - PENDING_VERIFICATION → VERIFIED, REJECTED, DUPLICATE
  - VERIFIED → ASSIGNED, IN_PROGRESS
  - ASSIGNED → IN_PROGRESS
  - IN_PROGRESS → RESOLVED
  - RESOLVED → REOPENED
  - REOPENED → IN_PROGRESS
- **UI Controls**: "Update Status" button in detail modal shows available next states
- **Action Options**: Grid of status buttons with visual feedback
- **API Call**: `PATCH /api/incidents/:id/status` via `updateIncidentStatus()`
- **Authorization**: Status updates restricted to ADMIN/OPERATOR roles
- **Response**: 
  - Timeline updates automatically
  - Toast notification confirms change
  - Related queries invalidated for live updates
  - Event history reflects new status immediately

### 4. Incident List Improvements
- **Filters**: 
  - **Status Filter**: All, Pending, Verified, In Progress, Resolved, Rejected
  - **Severity Filter**: All, CRITICAL, HIGH, MODERATE, LOW
  - Both filters work independently and in combination
- **Search**: Real-time search across incident title and category
- **Toolbar**:
  - Search field with clear button
  - Filter toggle button with visual active state
  - Incident count display
  - Active filter tag with quick remove
- **Visual Enhancements**:
  - Severity color coding (badges)
  - Status color coding (badges)
  - Row hover effect with cursor pointer to indicate clickability
  - Loading skeletons during data fetch
  - Empty state with helpful messaging
- **Responsive Design**: Table scrolls on small screens; stacked layout ready

### 5. UI Components

#### Timeline Component (`components/ui/Timeline.tsx`)
- Displays event history with visual timeline
- Event types: status, evidence, comment, system
- Icon and color coding by event type
- Shows timestamp, title, description, and metadata
- Connector lines between events
- Empty state for no events

#### StatusTimeline Component (`components/ui/StatusTimeline.tsx`)
- Specialized timeline for incident status changes
- Transforms incident event data to timeline format
- Shows status transitions with from/to details

#### Enhanced Badge Component
- Existing Badge component supports severity and status variants
- Color-coded by incident severity (CRITICAL=red, HIGH=orange, MODERATE=teal, LOW=green)
- Status badges with semantic colors (RESOLVED=green, IN_PROGRESS=blue, PENDING=amber, etc.)

#### Modal Component (Enhanced)
- Width customizable (default 520px, detail modal uses 600px)
- Header with eyebrow label
- Body scrolls on content overflow
- Optional footer with action buttons
- Click-outside dismissible
- Accessible with ARIA attributes

### 6. API Client Updates (`apps/web/src/api.ts`)
- `createIncident()`: POST incident with all fields, returns incident ID
- `updateIncidentStatus()`: PATCH status with authorization checks
- `getIncident()`: GET full incident detail with events, evidence, relations
- `getIncidents()`: GET list with pagination, optional status filter
- Error handling: ApiError class with status codes and messages
- Request authentication: Bearer token in all requests
- Response typing: Full TypeScript support with incident detail interfaces

### 7. State Management
- **React Query**: 
  - Query keys: `['incidents', token, statusFilter, severityFilter]` for list
  - Query key: `['incident', token, incidentId]` for detail
  - Invalidation triggers: status updates, new incidents, detail panel updates
  - Retry disabled for user-initiated operations (showing errors immediately)
- **React State**:
  - Form visibility (showForm)
  - Filter visibility (showFilters)
  - Selected incident (selectedIncidentId)
  - Status action mode (statusAction in detail modal)
  - Download state (downloadingId for UI feedback)
- **Error Handling**: Try-catch blocks around API calls with user-facing messages via toast

### 8. Styling & Design System

#### CSS Variables Used
- Backgrounds: `--bg`, `--panel`, `--panel-2`, `--surface`
- Borders: `--border`, `--border-2`
- Text: `--text`, `--text-2`, `--muted`, `--faint`
- Semantic: `--teal`, `--amber`, `--red`, `--green`, `--blue`

#### New CSS Classes Added to `index.css`
- `.incident-detail`: Main detail container
- `.detail-section`: Grouped content areas
- `.detail-grid`: 2-column layout for metadata
- `.detail-heading`: Section headers with icons
- `.timeline-*`: Complete timeline styling
- `.evidence-*`: Evidence file styling
- `.related-*`: Related incidents styling
- `.filter-row`: Multi-section filter UI
- `.filter-chip`, `.filter-chip-active`: Filter buttons
- `.action-option`: Status action buttons
- `.detail-action`: Status update section

#### Responsive Behavior
- Mobile-first approach maintained
- Modals responsive (600px on desktop, constrained on mobile)
- Detail grid stacks on small screens
- Filter row adapts with flex wrapping

## Data Flow

### Create Incident Flow
1. User clicks "New report" button
2. Form modal opens with empty fields (default coordinates)
3. User fills form and submits
4. `createIncident()` sends data to API
5. API creates incident with PENDING_VERIFICATION status
6. Success: modal closes, toast shows, list refreshes
7. Error: toast displays error message

### View Incident Details Flow
1. User clicks incident row in list
2. `IncidentDetailModal` opens with loading state
3. `useQuery` fetches incident data from `GET /api/incidents/:id`
4. Detail loads with:
   - Incident metadata (id, category, severity, status, location)
   - Description text
   - Event timeline (all status changes)
   - Evidence files (media type, size)
   - Related incidents (similarity, reasons)
5. User can close modal or perform status update

### Update Status Flow
1. User clicks "Update Status" button in detail modal
2. Available next states shown as action buttons
3. User selects target status
4. `updateIncidentStatus()` sends PATCH request
5. API validates transition, updates incident, logs event
6. Success: detail refreshes, toast confirms, related queries invalidate
7. Timeline automatically updates with new event
8. User stays in detail view unless they close modal

## API Endpoints Used

### POST /api/incidents
Create new incident
- Request: title, description, category, severity, latitude, longitude
- Response: { incident: { id, title, status, created_at } }
- Authorization: Bearer token (any authenticated user)

### GET /api/incidents
List incidents with pagination and filtering
- Query params: page, limit, status
- Response: { items: Incident[], page, limit }
- Authorization: Bearer token (field reporters see only own; admins/operators see all)

### GET /api/incidents/:id
Get incident detail with events, evidence, related incidents
- Response: { incident: Incident, events: Event[], evidence: Evidence[], relatedIncidents: Relation[] }
- Authorization: Bearer token (field reporters see own; operators/admins see all)

### PATCH /api/incidents/:id/status
Update incident status with validation
- Request: { status: string }
- Response: { incident: { id, status } }
- Authorization: Bearer token + ADMIN/OPERATOR role

## TypeScript Types

```typescript
type Incident = {
  id: string;
  title: string;
  description?: string;
  category: IncidentCategory;
  severity: Severity;
  status: IncidentStatus;
  is_synthetic: boolean;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at?: string;
  zone_name?: string;
};

type IncidentDetail = {
  incident: Incident;
  events: IncidentEvent[];
  evidence: IncidentEvidence[];
  relatedIncidents: { similarity_score: number; reasons: string[]; id: string; title: string; status: IncidentStatus }[];
};

type IncidentEvent = {
  event_type: string;
  details: unknown;
  created_at: string;
};

type IncidentEvidence = {
  id: string;
  media_type: string;
  size_bytes: number;
  created_at: string;
};
```

## Testing Checklist

- [x] Create incident with all required fields
- [x] Form validation prevents incomplete submissions
- [x] Incident appears in list after creation
- [x] Click incident row opens detail modal
- [x] Detail modal shows all incident information
- [x] Timeline displays all status changes
- [x] Status update button shows available transitions
- [x] Status update works and timeline updates
- [x] Search filters incidents by title/category
- [x] Status filter shows only filtered incidents
- [x] Severity filter works independently
- [x] Toast notifications appear for all actions
- [x] Error messages display properly
- [x] Modal closes on backdrop click
- [x] No console errors
- [x] Types check cleanly (tsc build passes)

## Future Enhancements

1. **Map-based Location Picker**: Replace lat/lng inputs with interactive map in create form
2. **Evidence Upload**: Direct file upload in detail modal with image preview
3. **Comments/Notes**: Add note field in status update modal for operator notes
4. **Date Range Filter**: Filter by date range in list
5. **Sorting**: Sort by date, severity, or status
6. **Pagination**: Handle large lists with client-side pagination
7. **Bulk Actions**: Update multiple incidents at once
8. **Export**: Export incident list to CSV/JSON
9. **Geospatial Analysis**: Show incidents on map with clustering
10. **Real-time Updates**: WebSocket connection for live incident updates
11. **Download Evidence**: Implement actual file downloads (currently stubs)
12. **Incident Templates**: Quick incident creation from templates
13. **Duplicate Merging**: UI to merge duplicate incidents
14. **Print/PDF**: Print incident details or generate PDF reports

## Performance Considerations

- **Query Caching**: React Query caches incident lists and details
- **Search Debouncing**: Real-time search runs on client-side filtered data (no API call)
- **Modal Loading**: Detail modal shows loading state while fetching
- **Skeleton Screens**: List shows loading skeletons during initial fetch
- **Lazy Filters**: Filter row only renders when expanded
- **Event Delegation**: Table rows use event stopPropagation to prevent bubbling

## Accessibility

- Semantic HTML (table, modal, form)
- ARIA attributes (aria-label, aria-expanded, aria-modal, role)
- Keyboard navigation (buttons, form inputs, modal dismissal)
- Focus management (modal focus trap via backdrop click)
- Color not sole differentiator (badges use text + color)
- Readable font sizes (11px min for content, 12px for labels)
- Sufficient contrast (dark theme maintains WCAG AA compliance)

## Deployment Notes

1. Environment variables: `VITE_API_URL` for API endpoint
2. Database migration: Incident schema already seeded
3. No new dependencies added (uses existing: React, React Query, Lucide, TypeScript)
4. Build process: `npm run build` produces optimized dist/
5. Docker: Web service runs on port 5173 with health check
6. API: Expects running PostgreSQL with incident tables + PostGIS
7. Authentication: Bearer token in all requests (same as existing)

## Monitoring & Analytics

The system logs:
- Incident creation events in `incident_events` table
- Status changes with actor_id and timestamp
- Audit log entries for authorization events
- Error messages via API error responses

Key metrics to track:
- Incident creation rate
- Average time to resolution by severity
- Status transition frequencies
- User actions per incident

## Support & Troubleshooting

### Issue: Modal won't close
- Check if clicking backdrop (outside modal)
- Try pressing Escape key (if implemented)
- Look for console errors

### Issue: Status update fails
- Verify user role is ADMIN or OPERATOR
- Check if status transition is valid in STATUS_TRANSITIONS
- Confirm API is running (check health endpoint)
- Look at network request in browser DevTools

### Issue: Incident list is empty
- Check if there are incidents in database
- Verify status filter isn't set to non-existent status
- Try clearing search and filters
- Check API response in network tab

### Issue: Timeline not showing events
- Verify incident has status changes (events)
- Check if events were logged on creation (should have SUBMITTED event)
- Look for errors in console

### Issue: Evidence not downloading
- Current implementation is a stub (shows UI feedback only)
- To implement: Add `GET /api/incidents/:id/evidence/:evidenceId` endpoint
- Update handler to trigger actual file download

## Contributing

When adding features:
1. Keep components modular and reusable
2. Follow existing naming conventions (PascalCase components, camelCase state)
3. Use consistent icon set (Lucide React)
4. Test on mobile viewports
5. Check TypeScript compilation
6. Update this documentation
7. Run `npm run build && npm test` before submitting
