import Map from '../components/map/Map';

export default function MapRoute() {
  const { mapName } = useParams();
  return <Map mapName={mapName} />;
}
