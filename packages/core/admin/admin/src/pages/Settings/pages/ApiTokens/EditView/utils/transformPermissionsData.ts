import { ApiTokenPermission } from '../../../../../../contexts/apiTokenPermissions';

interface Layout {
  allActionsIds: string[];
  permissions: {
    apiId: string;
    label: string;
    controllers: { controller: string; actions: { action: string; actionId: string }[] }[];
  }[];
}

export const transformPermissionsData = (data: ApiTokenPermission) => {
  const layout: Layout = {
    allActionsIds: [],
    permissions: [],
  };

  layout.permissions = Object.entries(data).map(([apiId, value]) => ({
    apiId,
    label: apiId.split('::')[1],
    controllers: Object.keys(value.controllers)
      .map((controller) => ({
        controller,
        actions:
          controller in value.controllers
            ? value.controllers[controller]
                .map((action) => {
                  const actionId = `${apiId}.${controller}.${action}`;

                  if (apiId.includes('api::')) {
                    layout.allActionsIds.push(actionId);
                  }

                  return {
                    action,
                    actionId,
                  };
                })
                .flat()
            : [],
      }))
      .flat(),
  }));

  return layout;
};
