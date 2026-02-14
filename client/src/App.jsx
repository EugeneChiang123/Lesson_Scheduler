import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Book from './pages/Book';
import SetupHome from './pages/SetupHome';
import SetupEventForm from './pages/SetupEventForm';
import BookingsCalendar from './pages/BookingsCalendar';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/book/:eventTypeSlug" element={<Book />} />
      <Route path="/setup" element={<SetupHome />} />
      <Route path="/setup/bookings" element={<BookingsCalendar />} />
      <Route path="/setup/new" element={<SetupEventForm />} />
      <Route path="/setup/:id/edit" element={<SetupEventForm />} />
    </Routes>
  );
}
