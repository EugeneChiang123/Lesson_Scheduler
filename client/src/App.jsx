import { Routes, Route, Navigate } from 'react-router-dom';
import Book from './pages/Book';
import InstructorLayout from './components/InstructorLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ProfessionalSlugGuard from './components/ProfessionalSlugGuard';
import SetupHome from './pages/SetupHome';
import SetupEventForm from './pages/SetupEventForm';
import BookingsCalendar from './pages/BookingsCalendar';
import EventEditPage from './pages/EventEditPage';
import BookingPlaceholderPage from './pages/BookingPlaceholderPage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';

/** Shared child routes for /setup and /:professionalSlug (single source of truth). */
const instructorChildRoutes = [
  { index: true, element: <SetupHome />, key: 'index' },
  { path: 'bookings/:bookingId', element: <EventEditPage />, key: 'bookings-id' },
  { path: 'bookings', element: <BookingsCalendar />, key: 'bookings' },
  { path: 'new', element: <SetupEventForm />, key: 'new' },
  { path: ':id/edit', element: <SetupEventForm />, key: 'edit' },
];

function renderInstructorChildRoutes() {
  return instructorChildRoutes.map((r) =>
    r.index ? (
      <Route key={r.key} index element={r.element} />
    ) : (
      <Route key={r.key} path={r.path} element={r.element} />
    )
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/setup" replace />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="/book/:eventTypeSlug" element={<Book />} />
      <Route path="/booking/placeholder" element={<BookingPlaceholderPage />} />
      <Route
        path="/setup"
        element={
          <ProtectedRoute>
            <InstructorLayout />
          </ProtectedRoute>
        }
      >
        {renderInstructorChildRoutes()}
      </Route>
      <Route
        path="/:professionalSlug"
        element={
          <ProtectedRoute>
            <ProfessionalSlugGuard />
          </ProtectedRoute>
        }
      >
        <Route element={<InstructorLayout />}>
          {renderInstructorChildRoutes()}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
