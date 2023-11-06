import * as React from 'react';

import { ContentLayout, Flex, Main } from '@strapi/design-system';
import {
  Form,
  SettingsPageTitle,
  useFetchClient,
  useFocusWhenNavigate,
  useGuidedTour,
  useNotification,
  useOverlayBlocker,
  useRBAC,
  useTracking,
} from '@strapi/helper-plugin';
import { Entity } from '@strapi/types';
import { AxiosError } from 'axios';
import { Formik, FormikHelpers } from 'formik';
import { useIntl } from 'react-intl';
import { useQuery } from 'react-query';
import { useSelector } from 'react-redux';
import { useHistory, useRouteMatch } from 'react-router-dom';

import {
  ApiTokenPermissionsProvider,
  PseudoEvent,
  ApiTokenPermission,
} from '../../../../../contexts/apiTokenPermissions';
import { selectAdminPermissions } from '../../../../../selectors';
import { formatAPIErrors } from '../../../../../utils/formatAPIErrors';
import { API_TOKEN_TYPE } from '../../../components/Tokens/constants';
// @ts-expect-error not converted yet
import FormHead from '../../../components/Tokens/FormHead';
// @ts-expect-error not converted yet
import TokenBox from '../../../components/Tokens/TokenBox';

import { FormApiTokenContainer } from './components/FormApiTokenContainer';
import { LoadingView } from './components/LoadingView';
import { Permissions } from './components/Permissions';
import { schema } from './constants';
import { initialState, reducer } from './reducer';

const MSG_ERROR_NAME_TAKEN = 'Name already taken';

import { transformPermissionsData } from './utils/transformPermissionsData';

interface ApiToken {
  accessKey: string;
  createdAt: string;
  description: string;
  expiresAt: string;
  id: Entity.ID;
  lastUsedAt: string | null;
  lifespan: string;
  name: string;
  permissions: any[];
  type: 'custom' | 'full-access' | 'read-only';
  updatedAt: string;
}

export const EditView = () => {
  useFocusWhenNavigate();
  const { formatMessage } = useIntl();
  const { lockApp, unlockApp } = useOverlayBlocker();
  const toggleNotification = useNotification();
  const history = useHistory();
  const permissions = useSelector(selectAdminPermissions);
  const [apiToken, setApiToken] = React.useState<ApiToken>(
    // @ts-expect-error this is probably fine for now
    history.location.state?.apiToken.accessKey
      ? {
          // @ts-expect-error this is probably fine for now
          ...history.location.state.apiToken,
        }
      : null
  );
  const { trackUsage } = useTracking();
  const { setCurrentStep } = useGuidedTour();
  const {
    allowedActions: { canCreate, canUpdate, canRegenerate },
    // @ts-expect-error permissions.settings is defined
  } = useRBAC(permissions.settings['api-tokens']);
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const match = useRouteMatch<{ id: string }>('/settings/api-tokens/:id');
  const id = match?.params?.id;
  const { get, post, put } = useFetchClient();

  const isCreating = id === 'create';

  useQuery(
    'content-api-permissions',
    async () => {
      const [permissions, routes] = await Promise.all(
        ['/admin/content-api/permissions', '/admin/content-api/routes'].map(async (url) => {
          if (url === '/admin/content-api/permissions') {
            const {
              data: { data },
            } = await get<{ data: ApiTokenPermission[] }>(url);
            return data;
          } else if (url === '/admin/content-api/routes') {
            const {
              data: { data },
            } = await get<{ data: ApiTokenPermission }>(url);
            return data;
          }
        })
      );

      dispatch({
        type: 'UPDATE_PERMISSIONS_LAYOUT',
        value: permissions,
      });

      dispatch({
        type: 'UPDATE_ROUTES',
        value: routes,
      });

      if (apiToken) {
        if (apiToken?.type === 'read-only') {
          dispatch({
            type: 'ON_CHANGE_READ_ONLY',
          });
        }
        if (apiToken?.type === 'full-access') {
          dispatch({
            type: 'SELECT_ALL_ACTIONS',
          });
        }
        if (apiToken?.type === 'custom') {
          dispatch({
            type: 'UPDATE_PERMISSIONS',
            value: apiToken?.permissions,
          });
        }
      }
    },
    {
      onError() {
        toggleNotification({
          type: 'warning',
          message: { id: 'notification.error', defaultMessage: 'An error occured' },
        });
      },
    }
  );

  React.useEffect(() => {
    trackUsage(isCreating ? 'didAddTokenFromList' : 'didEditTokenFromList', {
      tokenType: API_TOKEN_TYPE,
    });
  }, [isCreating, trackUsage]);

  const { status } = useQuery(
    ['api-token', id],
    async () => {
      const {
        data: { data },
      } = await get<{ data: ApiToken }>(`/admin/api-tokens/${id}`);

      setApiToken({
        ...data,
      });

      if (data?.type === 'read-only') {
        dispatch({
          type: 'ON_CHANGE_READ_ONLY',
        });
      }
      if (data?.type === 'full-access') {
        dispatch({
          type: 'SELECT_ALL_ACTIONS',
        });
      }
      if (data?.type === 'custom') {
        dispatch({
          type: 'UPDATE_PERMISSIONS',
          value: data?.permissions,
        });
      }

      return data;
    },
    {
      enabled: !isCreating && !apiToken,
      onError() {
        toggleNotification({
          type: 'warning',
          message: { id: 'notification.error', defaultMessage: 'An error occured' },
        });
      },
    }
  );

  const handleSubmit = async (
    body: Pick<ApiToken, 'name' | 'description' | 'type' | 'lifespan'>,
    actions: FormikHelpers<Pick<ApiToken, 'name' | 'description' | 'type' | 'lifespan'>>
  ) => {
    trackUsage(isCreating ? 'willCreateToken' : 'willEditToken', {
      tokenType: API_TOKEN_TYPE,
    });

    lockApp();

    const lifespanVal =
      body.lifespan && parseInt(body.lifespan, 10) && body.lifespan !== '0'
        ? parseInt(body.lifespan, 10)
        : null;

    try {
      const {
        data: { data: response },
      } = isCreating
        ? await post(`/admin/api-tokens`, {
            ...body,
            lifespan: lifespanVal,
            permissions: body.type === 'custom' ? state.selectedActions : null,
          })
        : await put(`/admin/api-tokens/${id}`, {
            name: body.name,
            description: body.description,
            type: body.type,
            permissions: body.type === 'custom' ? state.selectedActions : null,
          });

      if (isCreating) {
        history.replace(`/settings/api-tokens/${response.id}`, { apiToken: response });
        setCurrentStep('apiTokens.success');
      }

      unlockApp();

      setApiToken({
        ...response,
      });

      toggleNotification({
        type: 'success',
        message: isCreating
          ? formatMessage({
              id: 'notification.success.apitokencreated',
              defaultMessage: 'API Token successfully created',
            })
          : formatMessage({
              id: 'notification.success.apitokenedited',
              defaultMessage: 'API Token successfully edited',
            }),
      });

      trackUsage(isCreating ? 'didCreateToken' : 'didEditToken', {
        type: apiToken.type,
        tokenType: API_TOKEN_TYPE,
      });
    } catch (err) {
      if (err instanceof AxiosError && err.response) {
        const errors = formatAPIErrors(err.response.data);
        actions.setErrors(errors);

        if (err?.response?.data?.error?.message === MSG_ERROR_NAME_TAKEN) {
          toggleNotification({
            type: 'warning',
            message: err.response.data.message || 'notification.error.tokennamenotunique',
          });
        } else {
          toggleNotification({
            type: 'warning',
            message: err?.response?.data?.message || 'notification.error',
          });
        }
      }

      unlockApp();
    }
  };

  const [hasChangedPermissions, setHasChangedPermissions] = React.useState(false);

  const handleChangeCheckbox = ({ target: { value } }: PseudoEvent) => {
    setHasChangedPermissions(true);
    dispatch({
      type: 'ON_CHANGE',
      value,
    });
  };

  const handleChangeSelectAllCheckbox = ({
    target: { value },
  }: {
    target: { value: { action: string; actionId: string }[] };
  }) => {
    setHasChangedPermissions(true);
    dispatch({
      type: 'SELECT_ALL_IN_PERMISSION',
      value,
    });
  };

  const setSelectedAction = ({ target: { value } }: PseudoEvent) => {
    dispatch({
      type: 'SET_SELECTED_ACTION',
      value,
    });
  };

  const providerValue = {
    ...state,
    onChange: handleChangeCheckbox,
    onChangeSelectAll: handleChangeSelectAllCheckbox,
    setSelectedAction,
  };

  const canEditInputs = (canUpdate && !isCreating) || (canCreate && isCreating);
  const isLoading = !isCreating && !apiToken && status !== 'success';

  if (isLoading) {
    // @ts-expect-error this is probably fine for now
    return <LoadingView apiTokenName={apiToken?.name} />;
  }

  return (
    <ApiTokenPermissionsProvider value={providerValue}>
      <Main>
        <SettingsPageTitle name="API Tokens" />
        <Formik
          validationSchema={schema}
          validateOnChange={false}
          initialValues={{
            name: apiToken?.name || '',
            description: apiToken?.description || '',
            type: apiToken?.type,
            lifespan: apiToken?.lifespan ? apiToken.lifespan.toString() : apiToken?.lifespan,
          }}
          enableReinitialize
          onSubmit={(body, actions) => handleSubmit(body, actions)}
        >
          {({ errors, handleChange, isSubmitting, values, setFieldValue }) => {
            if (hasChangedPermissions && values?.type !== 'custom') {
              setFieldValue('type', 'custom');
            }

            return (
              <Form>
                <FormHead
                  backUrl="/settings/api-tokens"
                  title={{
                    id: 'Settings.apiTokens.createPage.title',
                    defaultMessage: 'Create API Token',
                  }}
                  token={apiToken}
                  setToken={setApiToken}
                  canEditInputs={canEditInputs}
                  canRegenerate={canRegenerate}
                  isSubmitting={isSubmitting}
                  regenerateUrl="/admin/api-tokens/"
                />

                <ContentLayout>
                  <Flex direction="column" alignItems="stretch" gap={6}>
                    {Boolean(apiToken?.name) && (
                      <TokenBox token={apiToken?.accessKey} tokenType={API_TOKEN_TYPE} />
                    )}
                    <FormApiTokenContainer
                      errors={errors}
                      onChange={handleChange}
                      canEditInputs={canEditInputs}
                      isCreating={isCreating}
                      values={values}
                      apiToken={apiToken}
                      onDispatch={dispatch}
                      setHasChangedPermissions={setHasChangedPermissions}
                    />
                    <Permissions
                      disabled={
                        !canEditInputs ||
                        values?.type === 'read-only' ||
                        values?.type === 'full-access'
                      }
                    />
                  </Flex>
                </ContentLayout>
              </Form>
            );
          }}
        </Formik>
      </Main>
    </ApiTokenPermissionsProvider>
  );
};
