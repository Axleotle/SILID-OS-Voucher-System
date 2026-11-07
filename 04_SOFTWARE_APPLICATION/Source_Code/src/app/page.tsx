import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function RootPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('silid_mock_session');
  if (session) {
    redirect('/staff');
  } else {
    redirect('/staff/login');
  }
}
