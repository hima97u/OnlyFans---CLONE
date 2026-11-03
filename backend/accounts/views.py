from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import AccountRegistrationSerializer, EmailLoginSerializer


def token_response(user):
    refresh = RefreshToken.for_user(user)
    handle = user.email.split('@', 1)[0]
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id': user.id,
            'email': user.email,
            'username': handle,
            'tag': f'@{handle}',
        },
    }


class EmailLoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = EmailLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(token_response(serializer.validated_data['user']))


class AccountRegistrationView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AccountRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(token_response(serializer.save()), status=status.HTTP_201_CREATED)


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        handle = request.user.email.split('@', 1)[0]
        return Response({
            'id': request.user.id,
            'email': request.user.email,
            'username': handle,
            'tag': f'@{handle}',
        })
