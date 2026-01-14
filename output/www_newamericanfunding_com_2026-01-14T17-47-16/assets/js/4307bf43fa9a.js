(function ($) {
    $.extend(true, epi.EPiServer.Forms, {
        Validators: {
            "NAF.Marketing.Web.Models.Forms.ReCaptchaV2Validator": function (fieldName, fieldValue, validatorMetaData) {
                if (fieldValue && fieldValue.replace('ReCaptchaV2ElementBlock|', '')) {
                    return {
                        isValid: true,
                        message: null
                    };
                } else {
                    return {
                        isValid: false,
                        message: validatorMetaData.model.message
                    };
                }
            }
        },
        Extension: {
            onBeforeSubmit: function (currentForm) {
                return this._getRecaptchaToken(currentForm);
            },

            // get reCaptcha token.
            _getRecaptchaToken: function (form) {
                var $deferred = $.Deferred(),
                    $recaptchaElement = $(form).find(".Form__Element.FormRecaptcha");

                // If we don't have recaptcha element -> do nothing.
                if (!$recaptchaElement.hasClass("FormRecaptcha")) {
                    $deferred.resolve();
                    return $deferred.promise();
                }

                try {
                    var id = $recaptchaElement.attr('id');
                    var reCaptchResponse = grecaptcha.getResponse(naf.recaptchav2.captchas[id].cref);
                    var hiddenId = '#' + naf.recaptchav2.captchas[id].fid;
                    var currentHiddenVal = $(hiddenId).val();
                    if (currentHiddenVal === 'ReCaptchaV2ElementBlock|') {
                        $(hiddenId).val(currentHiddenVal + reCaptchResponse);
                    }
                    $deferred.resolve(reCaptchResponse);
                    return $deferred.promise();
                } catch (err) {
                    console.log('err', err);
                    $deferred.resolve();
                    return $deferred.promise();
                };

                return $deferred.promise();
            },
        },
    });
})($$epiforms || $);

window.naf = window.naf || {};
naf.recaptchav2 = {
    captchas: {}
};
window.loadNAFRecaptchaCallback = function () {
    var elts = jQuery(".Form__Element.FormRecaptcha");
    elts.each(function (i, v) {
        var elt = jQuery(v);
        var id = elt.data('epiforms-element-name') + '_cc';
        var fid = elt.data('field-id');
        var siteKey = elt.data('sitekey');
        naf.recaptchav2.captchas[id] = {
            cref: grecaptcha.render(id, { 'sitekey': siteKey }),
            fid: fid
        };
    });
};