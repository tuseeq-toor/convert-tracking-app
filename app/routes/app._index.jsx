import { Page, Text, Card } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return null;
};

export default function Index() {
  return (
    <Page>
      <Card width="500px">
        <Text>This app tracks conversion data for convert</Text>
      </Card>
    </Page>
  );
}
