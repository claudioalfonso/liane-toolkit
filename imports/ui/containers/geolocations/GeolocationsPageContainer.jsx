import { Meteor } from "meteor/meteor";
import { withTracker } from "meteor/react-meteor-data";
import { Geolocations } from "/imports/api/geolocations/geolocations.js";
import GeolocationsPage from "/imports/ui/pages/admin/geolocations/GeolocationsPage.jsx";

export default withTracker(() => {
  const subsHandle = Meteor.subscribe("geolocations.all");
  const loading = !subsHandle.ready();

  const geolocations = subsHandle.ready()
    ? Geolocations.find().fetch()
    : [];

  return {
    loading,
    geolocations
  };
})(GeolocationsPage);
