export {
  GOOGLE_SCOPES,
  createOAuth2Client,
  getAuthenticatedClient,
  refreshTokenIfNeeded,
  isAuthRevoked,
  isRateLimited,
  classifyGoogleError,
  type ClassifiedError,
} from './auth';

export {
  listMessages,
  getMessage,
  sendMessage,
  type MessageSummary,
  type MessageFull,
} from './gmail';

export {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  type CalendarEvent,
  type CreateEventInput,
} from './calendar';

export {
  listFiles,
  getFile,
  getFileContent,
  uploadFile,
  type DriveFile,
  type DriveFileContent,
} from './drive';

export {
  getDocContent,
  type DocContent,
} from './docs';
