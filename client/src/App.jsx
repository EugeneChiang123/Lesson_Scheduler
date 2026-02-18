import { Routes, Route, Navigate } from 'react-router-dom';
import Book from './pages/Book';
import InstructorLayout from './components/InstructorLayout';
import ProtectedRoute from './components/ProtectedRoute';
import SetupHome from './pages/SetupHome';
import SetupEventForm from './pages/SetupEventForm';
import BookingsCalendar from './pages/BookingsCalendar';
import EventEditPage from './pages/EventEditPage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/setup" replace />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="/book/:eventTypeSlug" element={<Book />} />
      <Route
        path="/setup"
        element={
          <ProtectedRoute>
            <InstructorLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<SetupHome />} />
        <Route path="bookings/:bookingId" element={<EventEditPage />} />
        <Route path="bookings" element={<BookingsCalendar />} />
        <Route path="new" element={<SetupEventForm />} />
        <Route path=":id/edit" element={<SetupEventForm />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
