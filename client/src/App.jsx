import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Book from './pages/Book';
import InstructorLayout from './components/InstructorLayout';
import SetupHome from './pages/SetupHome';
import SetupEventForm from './pages/SetupEventForm';
import BookingsCalendar from './pages/BookingsCalendar';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/book/:eventTypeSlug" element={<Book />} />
      <Route path="/setup" element={<InstructorLayout />}>
        <Route index element={<SetupHome />} />
        <Route path="bookings" element={<BookingsCalendar />} />
        <Route path="new" element={<SetupEventForm />} />
        <Route path=":id/edit" element={<SetupEventForm />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
