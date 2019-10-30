"""
Contains Media panes including renderers for Audio and Video content.
"""
from __future__ import absolute_import, division, unicode_literals

import os

from base64 import b64encode
from io import BytesIO
from six import string_types

import numpy as np
import param

from ..models import (
    Audio as _BkAudio,
    Video as _BkVideo,
    VideoStream as _BkVideoStream
)
from .base import PaneBase


class _MediaBase(PaneBase):

    loop = param.Boolean(default=False, doc="""
        Whether the meida should loop""")

    time = param.Number(default=0, doc="""
        The current timestamp""")

    throttle = param.Integer(default=250, doc="""
        How frequently to sample the current playback time in milliseconds""")

    paused = param.Boolean(default=True, doc="""
        Whether the media is currently paused""")

    object = param.String(default='', doc="""
        The media file either local or remote.""")

    volume = param.Number(default=None, bounds=(0, 100), doc="""
        The volume of the media player.""")

    _rename = {'name': None, 'sample_rate': None, 'object': 'value'}

    _default_mime = None

    _media_type = None

    _formats = []

    __abstract = True

    _updates = True

    @classmethod
    def applies(cls, obj):
        if isinstance(obj, string_types):
            if os.path.isfile(obj) and any(obj.endswith('.'+fmt) for fmt in cls._formats):
                return True
            if cls._is_url(obj):
                return True
        if hasattr(obj, 'read'):  # Check for file like object
            return True
        return False

    @classmethod
    def _is_url(cls, obj):
        if isinstance(obj, string_types):
            lower_string = obj.lower()
            return (
                lower_string.startswith('http://')
                or lower_string.startswith('https://')
            ) and any(lower_string.endswith('.'+fmt) for fmt in cls._formats)
        return False

    def _init_properties(self):
        return {k: v for k, v in self.param.get_param_values()
                if v is not None and k not in ['default_layout']}

    def _get_model(self, doc, root=None, parent=None, comm=None):
        props = self._process_param_change(self._init_properties())
        model = self._bokeh_model(**props)
        if root is None:
            root = model
        self._models[root.ref['id']] = (model, parent)
        self._link_props(model, list(model.properties()), doc, root, comm)
        return model

    def _from_numpy(self, data):
        from scipy.io import wavfile
        buffer = BytesIO()
        wavfile.write(buffer, self.sample_rate, data)
        return buffer

    def _process_param_change(self, msg):
        msg = super(_MediaBase, self)._process_param_change(msg)
        if 'value' in msg:
            value = msg['value']
            if isinstance(value, np.ndarray):
                fmt = 'wav'
                buffer = self._from_numpy(value)
                data = b64encode(buffer.getvalue())
            elif os.path.isfile(value):
                fmt = object.split('.')[-1]
                with open(object, 'rb') as f:
                    data = f.read()
                data = b64encode(data)
            elif value.lower().startswith('http'):
                return msg
            elif not value:
                data, fmt = b'', self._default_mime
            else:
                raise ValueError('Object should be either path to a sound file or numpy array')
            template = 'data:audio/{mime};base64,{data}'
            msg['value'] = template.format(data=data.decode('utf-8'),
                                           mime=fmt)
            
        return msg


class Audio(_MediaBase):

    object = param.ClassSelector(default='', class_=(string_types + (np.ndarray,)), doc="""
        The audio file either local or remote.""")

    sample_rate = param.Integer(default=44100, doc="""
        The sample_rate of the audio when given a NumPy array.""")

    _formats = ['mp3', 'wav', 'ogg']

    _media_type = 'audio'

    _default_mime = 'wav'

    _bokeh_model = _BkAudio

    @classmethod
    def applies(cls, obj):
        return super(Audio, cls).applies(obj) or isinstance(obj, np.ndarray)



class Video(_MediaBase):

    _formats = ['mp4', 'webm', 'ogg']

    _media_type = 'video'

    _default_mime = 'mp4'

    _bokeh_model = _BkVideo
